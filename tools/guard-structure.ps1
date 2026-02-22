# Reach Structural Integrity Guard
# Ensures no accidental entropy in the root directory

$AllowedFiles = @(
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vitest.config.ts",
    "README.md",
    "Dockerfile",
    ".gitignore",
    ".dockerignore",
    "go.mod",
    "go.sum",
    "LICENSE",
    "tsc_errors.txt",
    "tsc_errors_2.txt",
    "tsc_errors_3.txt",
    "tsc_errors_final.txt",
    "tsc_errors_normalized.txt"
)

$AllowedDirs = @(
    ".git",
    ".github",
    ".vscode",
    ".gemini",
    "src",
    "services",
    "sdk",
    "tools",
    "test",
    "crates",
    "contracts",
    "node_modules",
    "dist"
)

$EntropyFound = $false

Get-ChildItem -Path "." | ForEach-Object {
    $name = $_.Name
    if ($_.PSIsContainer) {
        if ($name -notin $AllowedDirs) {
            Write-Error "Entropy Detected: Unexpected directory found in root: $name"
            $EntropyFound = $true
        }
    } else {
        if ($name -notin $AllowedFiles) {
            Write-Error "Entropy Detected: Unexpected file found in root: $name"
            $EntropyFound = $true
        }
    }
}

if ($EntropyFound) {
    Write-Host "`🚨 Structural violation detected. Maintain normalized structure.`" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`✅ Structural integrity maintained.`" -ForegroundColor Green
    exit 0
}
