$ErrorActionPreference = 'Stop'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$BinDir = if ($env:REACH_BIN_DIR) { $env:REACH_BIN_DIR } else { Join-Path $HOME '.reach/bin' }
New-Item -ItemType Directory -Path $BinDir -Force | Out-Null

Push-Location (Join-Path $Root 'services/runner')
go build -o (Join-Path $BinDir 'reachctl.exe') ./cmd/reachctl
Pop-Location

Write-Host "Installed reachctl to $(Join-Path $BinDir 'reachctl.exe')"
Write-Host 'Add this folder to PATH if needed.'
Write-Host 'Verify with: reachctl doctor'
