# Reach Go-Live Guide

> **Version:** 1.2  
> **Status:** Production  
> **Last Updated:** 2026-02-27

This guide covers installation, smoke testing, rollback procedures, debug bundle generation, and expected outputs for Reach with the Requiem C++ engine.

---

## 1. Prerequisites

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 18.x | 20.x LTS |
| pnpm | 8.x | 8.15+ |
| Rust | 1.75 | 1.78+ |
| Git | 2.40 | 2.45+ |
| RAM | 4 GB | 8 GB |
| Disk | 2 GB | 10 GB |

### Platform Support

- **Linux**: Ubuntu 20.04+, Debian 11+, Fedora 38+
- **macOS**: 12 (Monterey)+, Apple Silicon supported
- **Windows**: Windows 10/11 with WSL2 or native Windows build

---

## 2. Installation

### Standard Install

```bash
# Clone repository
git clone https://github.com/reach/decision-engine.git
cd decision-engine

# Run install script
./scripts/install.sh        # Linux/macOS
# or
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1  # Windows

# Verify installation
pnpm verify:fast
```

### Manual Install

```bash
pnpm install
pnpm -r build  # Build all workspaces including Rust engine
```

### Build Verification

After install, verify the Requiem engine exists:

```bash
$ ls -la crates/requiem/target/release/requiem
-rwxr-xr-x 1 reach/eng  45M Feb 27 10:00 crates/requiem/target/release/requiem
```

---

## 3. Smoke Test

The smoke test verifies core functionality before production use.

### Run Smoke Test

```bash
pnpm verify:smoke
```

### Expected Output

```
> reach verify:smoke

[INFO] Checking engine binary... OK (Requiem v1.2.0)
[INFO] Determinism check... OK (5/5 runs matched)
[INFO] Protocol handshake... OK (v1.0 ↔ v1.0)
[INFO] CAS integrity... OK
[INFO] Security hardening... OK (symlink protection, env sanitization)
[INFO] Fixed-point math... OK
[SUCCESS] Smoke test passed in 2.3s
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | One or more checks failed |
| 2 | Engine binary not found |
| 3 | Determinism mismatch |
| 4 | Protocol version mismatch |

---

## 4. Debug Bundle

When reporting issues, generate a debug bundle.

### Generate Bundle

```bash
reach doctor --bundle
```

### Bundle Contents

The bundle includes:

```
reach-debug-YYYYMMDD-HHMMSS/
├── version.txt              # Reach and Requiem versions
├── engine-info.json         # Engine metadata
├── protocol-debug.json      # Protocol state
├── config-dump.json         # Sanitized config (secrets redacted)
├── determinism-logs/       # Last 10 run fingerprints
├── cas-checksums.json       # CAS integrity hashes
├── recent-runs/             # Last 5 run transcripts (truncated)
└── system-info.json         # OS, Node, Rust versions
```

### Safe Sharing

Before sharing the bundle, review for sensitive data:

```bash
# Check what's included
reach doctor --bundle --dry-run

# Redact custom paths
reach doctor --bundle --redact-patterns=".*secret.*,.*token.*"
```

---

## 5. Rollback Procedures

### Engine Rollback

If Requiem causes issues, rollback to previous version:

```bash
# Check available versions
git tag -l 'requiem/v*'

# Checkout specific version
git checkout requiem/v1.1.0
pnpm install

# Rebuild engine
pnpm -r --filter requiem build
```

### Environment Variables for Rollback

| Variable | Purpose | Default |
|----------|---------|---------|
| `FORCE_RUST` | Use Rust engine instead of Requiem | unset (use Requiem) |
| `FORCE_REQUIEM` | Force Requiem engine | unset |
| `REACH_PROTOCOL_VERSION` | Pin protocol version | auto-negotiate |

### Protocol Pinning

If protocol version causes issues:

```bash
# Pin to specific version
REACH_PROTOCOL_VERSION=1.0 reach run my-pack

# Check protocol version
reach doctor --protocol
```

---

## 6. Expected Outputs

### Successful Run

```bash
$ reach run my-pack --input '{"prompt": "test"}'

[INFO] Loading pack my-pack... OK
[INFO] Engine: Requiem v1.2.0
[INFO] Protocol: v1.0 ( negotiated )
[INFO] Fingerprint: a1b2c3d4e5f6... (BLAKE3)
[INFO] Execution time: 1.234s
[INFO] Events logged: 42
[SUCCESS] Run completed
  Output: {...}
  Fingerprint: a1b2c3d4e5f6...
```

### Replay Verification

```bash
$ reach replay a1b2c3d4e5f6 --verify

[INFO] Loading transcript for a1b2c3d4e5f6... OK
[INFO] Original fingerprint: a1b2c3d4e5f6...
[INFO] Replaying events... OK (42 events)
[INFO] Replay fingerprint: a1b2c3d4e5f6...
[SUCCESS] Fingerprint VERIFIED (match)
```

### Determinism Check

```bash
$ reach verify:determinism --runs=10

[INFO] Running determinism check (10 runs)...
[RUN 1/10] Fingerprint: a1b2c3d4e5f6...
[RUN 2/10] Fingerprint: a1b2c3d4e5f6... ✓
[RUN 3/10] Fingerprint: a1b2c3d4e5f6... ✓
...
[RUN 10/10] Fingerprint: a1b2c3d4e5f6... ✓
[SUCCESS] All 10 runs produced identical fingerprints
```

---

## 7. Troubleshooting Quick Links

| Issue | See |
|-------|-----|
| Engine not found | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Determinism mismatch | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Protocol errors | [PROTOCOL.md](PROTOCOL.md) |
| Error codes | [ERRORS.md](ERRORS.md) |
| Security concerns | [SECURITY.md](SECURITY.md) |

---

## 8. Post-Install Checklist

Before production use, verify:

- [ ] `pnpm verify:smoke` passes
- [ ] `pnpm verify:determinism` passes (5+ runs)
- [ ] `reach doctor` shows all green
- [ ] Run a test pack successfully
- [ ] Verify replay produces matching fingerprint
- [ ] Generate debug bundle and review contents
