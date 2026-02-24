param(
  [string]$Version = $env:REACH_VERSION,
  [string]$InstallDir = "$env:ProgramFiles\Reach",
  [string]$ReleaseDir = $env:REACH_RELEASE_DIR,
  [string]$BaseUrl = $env:REACH_BASE_URL
)

$ErrorActionPreference = "Stop"

function Resolve-Version {
  param([string]$CurrentVersion, [string]$CurrentReleaseDir)
  if ($CurrentVersion) {
    return $CurrentVersion.Trim()
  }

  if ($CurrentReleaseDir -and (Test-Path (Join-Path $CurrentReleaseDir "VERSION"))) {
    return (Get-Content (Join-Path $CurrentReleaseDir "VERSION") -Raw).Trim()
  }

  $versionUrl = "https://raw.githubusercontent.com/reach/reach/main/VERSION"
  return (Invoke-RestMethod -Uri $versionUrl).Trim()
}

function Download-Asset {
  param(
    [string]$AssetName,
    [string]$Destination,
    [string]$CurrentReleaseDir,
    [string]$CurrentBaseUrl,
    [string]$ResolvedVersion
  )

  if ($CurrentReleaseDir) {
    Copy-Item -Path (Join-Path $CurrentReleaseDir $AssetName) -Destination $Destination -Force
    return
  }

  if (-not $CurrentBaseUrl) {
    $CurrentBaseUrl = "https://github.com/reach/reach/releases/download/v$ResolvedVersion"
  }
  $assetUrl = "$CurrentBaseUrl/$AssetName"
  Invoke-WebRequest -Uri $assetUrl -OutFile $Destination
}

function Get-ChecksumMap {
  param([string]$ChecksumFile)
  $map = @{}
  foreach ($line in Get-Content $ChecksumFile) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line -split "\s+", 2
    if ($parts.Length -lt 2) { continue }
    $hash = $parts[0].Trim().ToLowerInvariant()
    $name = $parts[1].Trim()
    if ($name.StartsWith("./")) {
      $name = $name.Substring(2)
    }
    if ($name.StartsWith(".\\")) {
      $name = $name.Substring(2)
    }
    $map[$name] = $hash
  }
  return $map
}

function Verify-Checksum {
  param(
    [string]$Path,
    [string]$AssetName,
    [hashtable]$ChecksumMap
  )
  if (-not $ChecksumMap.ContainsKey($AssetName)) {
    throw "No checksum entry found for $AssetName"
  }
  $expected = $ChecksumMap[$AssetName]
  $actual = (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) {
    throw "Checksum mismatch for $AssetName"
  }
}

function Install-Reach {
  $resolvedVersion = Resolve-Version -CurrentVersion $Version -CurrentReleaseDir $ReleaseDir
  if (-not $resolvedVersion) {
    throw "Could not resolve Reach version. Set REACH_VERSION."
  }

  $arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { throw "Unsupported architecture" }
  $binaryName = "reachctl-windows-$arch.exe"

  $tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("reach-install-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tmpDir | Out-Null
  try {
    $binaryPath = Join-Path $tmpDir $binaryName
    $wrapperPath = Join-Path $tmpDir "reach"
    $checksumsPath = Join-Path $tmpDir "SHA256SUMS"

    Write-Host "Installing Reach v$resolvedVersion (windows-$arch)..."
    Download-Asset -AssetName $binaryName -Destination $binaryPath -CurrentReleaseDir $ReleaseDir -CurrentBaseUrl $BaseUrl -ResolvedVersion $resolvedVersion
    Download-Asset -AssetName "reach" -Destination $wrapperPath -CurrentReleaseDir $ReleaseDir -CurrentBaseUrl $BaseUrl -ResolvedVersion $resolvedVersion
    Download-Asset -AssetName "SHA256SUMS" -Destination $checksumsPath -CurrentReleaseDir $ReleaseDir -CurrentBaseUrl $BaseUrl -ResolvedVersion $resolvedVersion

    $checksums = Get-ChecksumMap -ChecksumFile $checksumsPath
    Verify-Checksum -Path $binaryPath -AssetName $binaryName -ChecksumMap $checksums
    Verify-Checksum -Path $wrapperPath -AssetName "reach" -ChecksumMap $checksums

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Copy-Item -Path $binaryPath -Destination (Join-Path $InstallDir "reachctl.exe") -Force
    Copy-Item -Path $wrapperPath -Destination (Join-Path $InstallDir "reach") -Force

    $cmdShimPath = Join-Path $InstallDir "reach.cmd"
    @"
@echo off
"%~dp0reachctl.exe" %*
"@ | Set-Content -Path $cmdShimPath -NoNewline

    $psShimPath = Join-Path $InstallDir "reach.ps1"
    @"
`$ErrorActionPreference = 'Stop'
& "`$PSScriptRoot\reachctl.exe" @args
"@ | Set-Content -Path $psShimPath -NoNewline

    Write-Host "Reach installed to $InstallDir"
    Write-Host "Run: $InstallDir\reachctl.exe version"
    Write-Host "Then: $InstallDir\reachctl.exe doctor"
    Write-Host "Optional shims: reach.cmd and reach.ps1"
  }
  finally {
    if (Test-Path $tmpDir) {
      Remove-Item -Path $tmpDir -Recurse -Force
    }
  }
}

Install-Reach
