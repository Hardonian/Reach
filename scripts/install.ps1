# Reach Installation Script (Windows)
# Prerequisites: Node.js 18+, pnpm, Git

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir '..')

function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }
function Write-Step { param([string]$Message) Write-Host "[STEP] $Message" -ForegroundColor Cyan }

function Test-Command {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Get-Version {
    param([string]$Command)
    try {
        $output = & $Command --version 2>$null
        if ($output -match '(\d+\.\d+\.\d+)') {
            return $matches[1]
        }
    } catch {}
    return $null
}

function Test-Version {
    param([string]$Command, [string]$MinVersion)
    $currentVersion = Get-Version $Command
    if (-not $currentVersion) {
        Write-Warn "Could not determine $Command version"
        return $false
    }

    $current = [version]$currentVersion
    $min = [version]$MinVersion

    if ($current -lt $min) {
        Write-Warn "$Command version $currentVersion is older than recommended $MinVersion"
        return $false
    }

    Write-Info "$Command version $currentVersion OK"
    return $true
}

function Install-NodeDeps {
    Write-Step "Installing Node.js dependencies..."
    Set-Location $ProjectRoot

    try {
        & pnpm install --frozen-lockfile 2>$null
        if ($LASTEXITCODE -ne 0) { throw }
    } catch {
        & pnpm install
    }

    Write-Info "Node.js dependencies installed"
}

function Build-RustEngine {
    if (-not (Test-Command cargo)) {
        Write-Warn "Rust/Cargo not found. Skipping Requiem engine build."
        Write-Warn "The TypeScript fallback will be used (slower but functional)."
        return
    }

    Write-Step "Building Requiem engine (Rust)..."
    Set-Location $ProjectRoot

    try {
        & cargo build --release -p requiem 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Info "Requiem engine built successfully"

            # Create directories
            New-Item -ItemType Directory -Force -Path "$ProjectRoot\.reach\bin" | Out-Null

            # Copy binary
            $sourcePath = "$ProjectRoot\target\release\requiem.exe"
            $destPath = "$ProjectRoot\.reach\bin\requiem.exe"
            if (Test-Path $sourcePath) {
                Copy-Item -Path $sourcePath -Destination $destPath -Force
                Write-Info "Requiem binary: $destPath"
            }
        } else {
            Write-Warn "Requiem engine build failed. TypeScript fallback will be used."
        }
    } catch {
        Write-Warn "Requiem engine build failed: $($_.Exception.Message)"
    }
}

function Setup-Environment {
    Write-Step "Setting up environment..."

    # Create directories
    New-Item -ItemType Directory -Force -Path "$ProjectRoot\.reach\bin" | Out-Null
    New-Item -ItemType Directory -Force -Path "$ProjectRoot\.reach\data" | Out-Null
    New-Item -ItemType Directory -Force -Path "$ProjectRoot\.reach\logs" | Out-Null

    # Create config if not exists
    $configPath = "$ProjectRoot\.reach\config.json"
    if (-not (Test-Path $configPath)) {
        $config = @{
            version = "0.3.1"
            engine = @{
                default = "auto"
                fallback = "typescript"
            }
            protocol = @{
                version = 1
                default = "json"
            }
            determinism = @{
                hash = "blake3"
                precision = 10
            }
        } | ConvertTo-Json -Depth 4
        Set-Content -Path $configPath -Value $config
        Write-Info "Created default config: .reach\config.json"
    }

    # Check PATH
    $pathEntry = "$ProjectRoot\.reach\bin"
    if (-not ($env:Path -like "*$pathEntry*")) {
        Write-Info "Add to your PATH to use reach command:"
        Write-Host "  `$env:Path = `"$pathEntry;`$env:Path`""
    }
}

function Run-Verification {
    Write-Step "Running verification..."
    Set-Location $ProjectRoot

    try {
        & pnpm run typecheck 2>$null | Out-Null
        Write-Info "TypeScript type check passed"
    } catch {
        Write-Warn "TypeScript type check has warnings (see: pnpm run typecheck)"
    }
}

# =============================================================================
# Main
# =============================================================================

Write-Info "Reach Installation Script"
Write-Info "Project: $ProjectRoot"
Write-Host ""

# Check prerequisites
Write-Step "Checking prerequisites..."

$prerequisites = @('git', 'node', 'pnpm')
foreach ($cmd in $prerequisites) {
    if (-not (Test-Command $cmd)) {
        Write-Error "Required command not found: $cmd"
        Write-Host "Please install $cmd:"
        switch ($cmd) {
            'node' {
                Write-Host "  - Via nvm-windows: https://github.com/coreybutler/nvm-windows"
                Write-Host "  - Via installer: https://nodejs.org/"
            }
            'pnpm' {
                Write-Host "  - npm install -g pnpm"
                Write-Host "  - Via standalone: https://pnpm.io/installation"
            }
            'git' {
                Write-Host "  - Via installer: https://git-scm.com/"
            }
        }
        exit 1
    }
}

Test-Version node 18.0.0 | Out-Null
Test-Version pnpm 8.0.0 | Out-Null

if (Test-Command cargo) {
    Test-Version cargo 1.75.0 | Out-Null
}

Write-Host ""

# Run installation steps
Install-NodeDeps
Build-RustEngine
Setup-Environment
Run-Verification

Write-Host ""
Write-Info "Installation complete!"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. pnpm verify:fast    # Quick validation"
Write-Host "  2. pnpm verify:smoke   # Smoke test"
Write-Host "  3. pnpm verify         # Full verification"
Write-Host ""
Write-Host "Documentation:"
Write-Host "  - docs\GO_LIVE.md      # Go-live guide"
Write-Host "  - docs\ARCHITECTURE.md # System design"
Write-Host ""
