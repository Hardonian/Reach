$ErrorActionPreference = 'Stop'

$Repo = 'reach/reach'
$BinDir = if ($env:REACH_BIN_DIR) { $env:REACH_BIN_DIR } else { Join-Path $HOME '.reach/bin' }
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("reach-install-" + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

try {
    $goArch = switch ($env:PROCESSOR_ARCHITECTURE.ToLower()) {
        'amd64' { 'amd64' }
        'arm64' { 'arm64' }
        default { throw "Unsupported architecture: $env:PROCESSOR_ARCHITECTURE" }
    }

    $version = $env:REACH_VERSION
    if (-not $version) {
        try {
            $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
            $version = $release.tag_name.TrimStart('v')
        }
        catch {
            $version = $null
        }
    }

    $installedFromRelease = $false
    if ($version) {
        Write-Host "Installing Reach v$version from GitHub releases..."
        $artifact = "reach_${version}_windows_${goArch}.exe"
        $artifactUrl = "https://github.com/$Repo/releases/download/v$version/$artifact"
        $sumUrl = "https://github.com/$Repo/releases/download/v$version/SHA256SUMS"
        $artifactPath = Join-Path $TempDir 'reach.exe'
        $sumPath = Join-Path $TempDir 'SHA256SUMS'

        try {
            Invoke-WebRequest -Uri $artifactUrl -OutFile $artifactPath
            Invoke-WebRequest -Uri $sumUrl -OutFile $sumPath
            $expectedLine = Select-String -Path $sumPath -Pattern ([regex]::Escape($artifact)) | Select-Object -First 1
            if (-not $expectedLine) { throw "Checksum entry not found for $artifact" }
            $expected = ($expectedLine.Line -split '\s+')[0]
            $actual = (Get-FileHash -Algorithm SHA256 -Path $artifactPath).Hash.ToLower()
            if ($actual -ne $expected.ToLower()) { throw 'Checksum verification failed' }
            New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
            Copy-Item -Path $artifactPath -Destination (Join-Path $BinDir 'reach.exe') -Force
            Copy-Item -Path $artifactPath -Destination (Join-Path $BinDir 'reachctl.exe') -Force
            $installedFromRelease = $true
        }
        catch {
            Write-Host "Release install failed: $($_.Exception.Message)"
        }
    }

    if (-not $installedFromRelease) {
        if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
            throw 'Go is required to build from source when release artifacts are unavailable.'
        }
        $root = Resolve-Path (Join-Path $PSScriptRoot '..')
        if (-not (Test-Path (Join-Path $root '.git'))) {
            throw 'Local source checkout not found for fallback build.'
        }
        Write-Host 'No release artifacts found; building Reach locally...'
        New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
        Push-Location (Join-Path $root 'services/runner')
        go build -trimpath -o (Join-Path $BinDir 'reach.exe') ./cmd/reachctl
        Pop-Location
        Copy-Item -Path (Join-Path $BinDir 'reach.exe') -Destination (Join-Path $BinDir 'reachctl.exe') -Force
    }

    Write-Host "Installed Reach CLI to $(Join-Path $BinDir 'reach.exe')"
    Write-Host "Optional compatibility alias: $(Join-Path $BinDir 'reachctl.exe')"
    Write-Host 'Add this directory to PATH if needed:'
    Write-Host "  `$env:Path = `"$BinDir;`$env:Path`""
    Write-Host 'Verify installation:'
    Write-Host '  reach version'
}
finally {
    if (Test-Path $TempDir) {
        Remove-Item -Path $TempDir -Recurse -Force
    }
}
