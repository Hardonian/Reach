# Reach Installation Guide

## Quick Install

### Linux / macOS

```bash
curl -fsSL https://github.com/reach/reach/releases/latest/download/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://github.com/reach/reach/releases/latest/download/install.ps1 | iex
```

## Verify Installation

```bash
reach version
reach doctor
reach demo
```

`reach demo` runs a sample flow, verifies and replays it, then creates a capsule.

## Manual Install with Checksum Verification (Linux/macOS)

```bash
VERSION=$(curl -fsSL https://raw.githubusercontent.com/reach/reach/main/VERSION)
BASE="https://github.com/reach/reach/releases/download/v${VERSION}"

curl -fsSL -O "${BASE}/reachctl-linux-amd64"
curl -fsSL -O "${BASE}/reach"
curl -fsSL -O "${BASE}/SHA256SUMS"

grep "reachctl-linux-amd64" SHA256SUMS | sha256sum -c -
grep "reach$" SHA256SUMS | sha256sum -c -

chmod +x reachctl-linux-amd64 reach
sudo mv reachctl-linux-amd64 /usr/local/bin/reachctl
sudo mv reach /usr/local/bin/reach
```

## Build From Source

Requirements:
- Go 1.22+
- Node.js 20+
- Rust toolchain (for core engine development)

```bash
git clone https://github.com/reach/reach.git
cd reach
npm install
make build
./reach version
./reach doctor
```

## Troubleshooting

If install or verification fails:

```bash
reach bugreport
```

Attach the generated zip to:
- https://github.com/reach/reach/issues/new?template=bug_report.yml

## Uninstall

Remove installed binaries:

```bash
sudo rm -f /usr/local/bin/reach /usr/local/bin/reachctl
```
