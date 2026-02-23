# Shrink Reach repository by removing large binaries from git history
# WARNING: This rewrites git history and changes commit hashes!

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
Write-Host "║          Reach Repository Size Reduction Script                ║" -ForegroundColor Yellow
Write-Host "║                                                                ║" -ForegroundColor Yellow
Write-Host "║  WARNING: This will rewrite git history!                       ║" -ForegroundColor Red
Write-Host "║  All commit hashes will change.                                ║" -ForegroundColor Red
Write-Host "║  Coordinate with team before running.                          ║" -ForegroundColor Red
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Yellow
Write-Host ""

# Safety check: Ensure we're in the repo root
if (-not (Test-Path ".git")) {
    Write-Host "Error: Must run from repository root" -ForegroundColor Red
    exit 1
}

# Check if git-filter-repo is available
$useFilterRepo = $null -ne (Get-Command "git-filter-repo" -ErrorAction SilentlyContinue)
if ($useFilterRepo) {
    Write-Host "✓ git-filter-repo found (recommended)" -ForegroundColor Green
} else {
    Write-Host "⚠ git-filter-repo not found, will use filter-branch" -ForegroundColor Yellow
    Write-Host "  Install git-filter-repo for better performance:"
    Write-Host "    pip install git-filter-repo"
    Write-Host ""
}

# Show current repo size
Write-Host "Current repository size:"
(Get-Item .git).Length / 1MB | ForEach-Object { "{0:N2} MB" -f $_ }
Write-Host ""

# List largest blobs before cleanup
Write-Host "Top 20 largest files in history:"
git rev-list --objects --all | 
    git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' |
    ForEach-Object { 
        $parts = $_ -split ' '
        if ($parts[0] -eq "blob") {
            [PSCustomObject]@{ Size = [int]$parts[2]; File = $parts[3] }
        }
    } |
    Sort-Object Size -Descending |
    Select-Object -First 20 |
    ForEach-Object { 
        $size = [math]::Round($_.Size / 1MB, 2)
        "{0:N2} MB`t{1}" -f $size, $_.File
    }
Write-Host ""

# Confirm with user
$confirm = Read-Host "⚠️  This will PERMANENTLY ALTER git history. Continue? [yes/no]"
if ($confirm -ne "yes") {
    Write-Host "Aborted."
    exit 0
}

Write-Host ""
Write-Host "Creating backup branch..."
$backupName = "backup-before-shrink-$(Get-Date -Format 'yyyyMMdd')"
git branch $backupName 2>$null
Write-Host "✓ Backup branch created: $backupName" -ForegroundColor Green
Write-Host ""

# Remove large blobs based on size threshold
$sizeThreshold = "10M"
Write-Host "Removing blobs larger than $sizeThreshold..."

if ($useFilterRepo) {
    # Modern approach using git-filter-repo (much faster)
    git filter-repo --strip-blobs-bigger-than "$sizeThreshold" --force
} else {
    # Legacy approach using filter-branch
    Write-Host "Using filter-branch (this may take a while)..."
    
    # Remove .exe files from history
    git filter-branch --force --index-filter `
        'git rm --cached --ignore-unmatch -r *.exe' `
        --prune-empty --tag-name-filter cat -- --all
    
    # Remove .zip files from history
    git filter-branch --force --index-filter `
        'git rm --cached --ignore-unmatch -r *.zip' `
        --prune-empty --tag-name-filter cat -- --all
}

Write-Host ""
Write-Host "Cleaning up refs and garbage collecting..."

# Remove old refs
Remove-Item -Recurse -Force .git/refs/original -ErrorAction SilentlyContinue
git reflog expire --expire=now --all

# Aggressive garbage collection
git gc --prune=now --aggressive

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "Repository size reduction complete!" -ForegroundColor Green
Write-Host ""
Write-Host "New repository size:"
(Get-Item .git).Length / 1MB | ForEach-Object { "{0:N2} MB" -f $_ }
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host ""
Write-Host "1. VERIFY everything still works:"
Write-Host "     make test" -ForegroundColor Cyan
Write-Host "     make verify" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. FORCE PUSH to remote (⚠️  COORDINATE WITH TEAM):" -ForegroundColor Red
Write-Host "     git push origin --force --all" -ForegroundColor Cyan
Write-Host "     git push origin --force --tags" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Team members will need to reclone or run:" -ForegroundColor Yellow
Write-Host "     git fetch origin" -ForegroundColor Cyan
Write-Host "     git reset --hard origin/main" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. If anything goes wrong, restore from backup:" -ForegroundColor Green
Write-Host "     git reset --hard $backupName" -ForegroundColor Cyan
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
