# Reach OSS

**Deterministic execution and replay for policy-governed runs.**

Reach provides a reproducible **run → transcript → verify → replay** lifecycle with evidence artifacts and stable fingerprints.

[![CI](https://github.com/reach/decision-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/reach/decision-engine/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Quick Start

```bash
# Install
pnpm install

# Verify everything works
pnpm verify

# Run smoke test
pnpm verify:smoke
```

See [docs/GO_LIVE.md](docs/GO_LIVE.md) for detailed installation and debugging.

## What You Get

- **Deterministic Execution:** Identical inputs produce identical fingerprints
- **Evidence Transcripts:** Complete audit trail of every run
- **Replay Verification:** Re-execute runs to verify integrity
- **Policy Gates:** Enforce rules at execution time
- **OSS-First:** All core features work without cloud dependencies

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Reach     │────▶│  Requiem    │────▶│   Replay    │
│   CLI/TS    │     │ Engine/Rust │     │  Verifier   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                    │
       ▼                                    ▼
┌─────────────┐                      ┌─────────────┐
│  Evidence   │◀─────────────────────│  Fingerprint│
│  Transcript │                      │   Match     │
└─────────────┘                      └─────────────┘
```

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript CLI and core |
| `crates/` | Rust engine (Requiem) |
| `docs/` | Documentation and specs |
| `tests/` | Integration tests |
| `scripts/` | Build and validation |

## Verification

```bash
# Quick check (lint + typecheck + unit tests)
pnpm verify:fast

# Full verification
pnpm verify

# OSS compliance
pnpm verify:oss

# Determinism stress test
pnpm verify:determinism
```

## Documentation

- [Go-Live Guide](docs/GO_LIVE.md) - Installation and operations
- [Architecture](docs/ARCHITECTURE.md) - System design
- [Contributing](CONTRIBUTING.md) - How to contribute
- [Security](SECURITY.md) - Security policy

## License

MIT © Reach Contributors
