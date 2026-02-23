# Reach Installation Guide

## Quick Install

### Using npm (Recommended for TypeScript/Node.js)
```bash
# Install the CLI globally
npm install -g @reach/cli

# Or use npx without installing
npx @reach/cli doctor
```

### Using pnpm
```bash
# Install the CLI globally
pnpm add -g @reach/cli

# Or use pnpm dlx without installing
pnpm dlx @reach/cli doctor
```

### Using pip (Python)
```bash
# Install the Python SDK
pip install reach-sdk

# Install CLI tools
pip install reach-cli
```

### Using Docker
```bash
# Pull the image
docker pull reach/reach:latest

# Run the server
docker run -p 8787:8787 -v reach-data:/data reach/reach:latest

# Run CLI commands
docker run --rm reach/reach:latest reach doctor
```

## Verifying Downloads

### Checksum Verification

After downloading releases, verify the integrity:

```bash
# Download the release
curl -L https://github.com/reach/reach/releases/download/v0.3.1/reach-linux-amd64.tar.gz -o reach.tar.gz

# Download checksums
curl -L https://github.com/reach/reach/releases/download/v0.3.1/SHA256SUMS -o SHA256SUMS

# Verify
sha256sum -c SHA256SUMS
```

Expected checksums for v0.3.1:
```
reach-linux-amd64  a1b2c3d4e5f6...
reach-darwin-amd64 f6e5d4c3b2a1...
reach-windows-amd64 9876543210ab...
```

## From Source

### Prerequisites

- Go 1.22+ (for server components)
- Node.js 18+ (for TypeScript SDK)
- Python 3.8+ (for Python SDK)
- Rust 1.70+ (for engine components)

### Clone and Build

```bash
# Clone the repository
git clone https://github.com/reach/reach.git
cd reach

# Install dependencies
npm install

# Build all components
npm run build

# Run tests
npm run test

# Verify version
npm run --silent version  # Should output: 0.3.1
```

## Platform-Specific Instructions

### macOS

```bash
# Using Homebrew (coming soon)
brew install reach

# Or install from source
make install-macos
```

### Linux

```bash
# Download the latest release
curl -L https://github.com/reach/reach/releases/latest/download/reach-linux-amd64.tar.gz | tar xz
sudo mv reach /usr/local/bin/

# Or install from source
make install-linux
```

### Windows

```powershell
# Using PowerShell
Invoke-WebRequest -Uri https://github.com/reach/reach/releases/latest/download/reach-windows-amd64.zip -OutFile reach.zip
Expand-Archive reach.zip -DestinationPath C:\Tools
# Add C:\Tools to your PATH
```

## Verification

After installation, verify everything is working:

```bash
# Check version (v0.3.1+)
reach version

# Check CLI is installed
reach doctor

# Check server can start
reach serve --port 8787 &
curl http://127.0.0.1:8787/health
```

Expected output from `reach version`:
```json
{
  "engineVersion": "0.3.1",
  "specVersion": "1.0.0",
  "schemaVersion": "1.0.0",
  "compatibilityPolicy": "backward_compatible",
  "supportedVersions": ["1.0.0"]
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REACH_DATA_DIR` | Data directory path | `./data` |
| `REACH_BASE_URL` | API base URL | `http://127.0.0.1:8787` |
| `REACH_LOG_LEVEL` | Logging level | `info` |

### Configuration File

Create `~/.reach/config.yaml`:

```yaml
server:
  port: 8787
  bind: 127.0.0.1

data:
  directory: ~/.reach/data

logging:
  level: info
  format: json
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 8787
lsof -i :8787

# Use a different port
reach serve --port 8788
```

### Permission Denied

```bash
# Fix data directory permissions
chmod 755 ~/.reach/data
```

### Connection Refused

```bash
# Check if server is running
curl http://127.0.0.1:8787/health

# Start the server
reach serve
```

### Version Mismatch

If you see version compatibility errors, ensure:
- Your CLI version matches the expected engine version
- Run `reach version` to check both engine and spec versions
- See [API_VERSIONING.md](API_VERSIONING.md) for compatibility policy

## Uninstallation

```bash
# npm
npm uninstall -g @reach/cli

# pnpm
pnpm remove -g @reach/cli

# pip
pip uninstall reach-sdk reach-cli

# Docker
docker rmi reach/reach:latest

# Source
make uninstall
```
