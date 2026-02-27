# Reach Go-Live Guide

> **Version:** 0.3.1  
> **Status:** Pre-release (Protocol Alignment WIP)  
> **Updated:** 2026-02-26

## Quick Start

### Prerequisites

- **Node.js:** 18.x - 22.x (LTS recommended)
- **pnpm:** 8.x or higher (required for workspace support)
- **Rust:** 1.75+ (optional, for building Requiem engine from source)
- **Git:** 2.40+

### One-Command Install

```bash
# Clone the repository
git clone https://github.com/reach/decision-engine.git
cd decision-engine

# Run install script
./scripts/install.sh        # Linux/macOS
.\scripts\install.ps1       # Windows

# Or manually:
pnpm install
```

### One-Command Verification

```bash
# Run all checks
pnpm verify

# Quick smoke test
pnpm verify:smoke

# Full OSS verification
pnpm verify:oss
```

## Directory Structure

```
decision-engine/
├── src/                    # TypeScript source
│   ├── cli/               # CLI commands
│   ├── core/              # Core types and utilities
│   ├── determinism/       # Deterministic primitives
│   ├── dgl/               # Decision graph layer
│   ├── engine/            # Execution engine adapters
│   ├── lib/               # Shared utilities
│   └── protocol/          # Binary protocol (WIP)
├── crates/                # Rust workspace (Requiem engine)
│   ├── engine/            # Core engine
│   ├── engine-core/       # Determinism invariants
│   └── requiem/           # Requiem CLI
├── docs/                  # Documentation
│   ├── specs/             # Specification documents
│   ├── adr/               # Architecture decisions
│   └── archive/           # Historical docs
├── scripts/               # Build and validation scripts
├── tests/                 # Test fixtures and integration tests
└── packages/              # Workspace packages
```

## Verification Commands

| Command | Purpose | Time |
|---------|---------|------|
| `pnpm verify:fast` | Quick validation (lint, typecheck, unit tests) | ~30s |
| `pnpm verify` | Full validation including smoke | ~2m |
| `pnpm verify:oss` | OSS purity + boundaries + language | ~1m |
| `pnpm verify:determinism` | Determinism stress test (200 runs) | ~5m |
| `pnpm verify:security` | Security scan | ~30s |

## Debug Commands

### Doctor (Environment Check)

```bash
npx tsx src/cli/doctor-cli.ts
```

Shows:
- Node.js and pnpm versions
- Engine binary availability
- Protocol version compatibility
- CAS integrity status

### Bug Report (Safe Diagnostics)

```bash
npx tsx src/cli/doctor-cli.ts --bugreport
```

Produces a redacted diagnostic bundle with:
- Version information
- Environment names (no values)
- Protocol stats
- Last error codes
- System capabilities

**No secrets are included.** Raw payloads require explicit `--include-payloads`.

## Rollback Procedures

### Pin Engine Version

```bash
# Use specific engine binary
export REQUIEM_BIN=/path/to/requiem-v0.2.1

# Or via config
echo '{"engineVersion": "0.2.1"}' > .reach/config.json
```

### Pin Protocol Version

```bash
# Force JSON protocol (slower but stable)
export REACH_PROTOCOL=json

# Or disable daemon
export REACH_DAEMON=false
```

### Emergency Fallback

```bash
# Use TypeScript fallback (no Rust engine)
export REACH_ENGINE=typescript
```

## Known Issues

### Protocol Layer (WIP)

The binary protocol between Reach and Requiem is currently being aligned:
- Type definitions are transitioning to the new schema
- Some adapter implementations use legacy field names
- Full binary protocol support coming in v0.4.0

**Workaround:** Use JSON protocol mode:
```bash
export REACH_PROTOCOL=json
```

### Windows Support

- All core functionality works on Windows
- Some symlink tests are skipped (OS limitation)
- Shell scripts use PowerShell equivalents

## CI/CD Integration

### GitHub Actions

```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v2
  with:
    version: 8
- run: pnpm install
- run: pnpm verify:fast
- run: pnpm verify:smoke
```

### Required Checks

All PRs must pass:
1. `pnpm verify:oss` - OSS purity
2. `pnpm validate:language` - Canonical terminology
3. `pnpm validate:boundaries` - Import boundaries
4. `cargo test -p engine-core` - Rust determinism

## Security

See [SECURITY.md](../SECURITY.md) for:
- Threat model
- Supported security features
- Reporting vulnerabilities

## Support

- Issues: [GitHub Issues](https://github.com/reach/decision-engine/issues)
- Discussions: [GitHub Discussions](https://github.com/reach/decision-engine/discussions)
- Security: security@reach.example.com

## License

MIT - See [LICENSE](../LICENSE)
