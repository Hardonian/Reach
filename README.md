# Reach OSS

**Deterministic execution and replay for policy-governed runs.**

Reach is an OSS execution and replay toolkit for teams that need inspectable run transcripts, evidence artifacts, and deterministic fingerprints. The repository contains local TypeScript, Go, and Rust components; hosted control-plane, enterprise, customer, and revenue claims are out of scope for this OSS repository.

## Quick Start

```bash
# Install (requires Node 18+, pnpm 8+, Rust 1.75+)
git clone https://github.com/Hardonian/Reach.git
cd Reach
pnpm install

# Smoke test - verifies engine, determinism, and protocol
pnpm verify:smoke
```

## What This Is

Reach is a deterministic execution engine with replay verification. Every run produces a fingerprint (BLAKE3 hash) that can be independently recomputed from the event log. The system guarantees:

- **Identical inputs → Identical fingerprints** (determinism)
- **Replay verification** (re-run any transcript to verify integrity)
- **Evidence chain** (cryptographically linked: Input → Policy → Artifacts → Execution → Output → Fingerprint)
- **Protocol stability** (streaming binary protocol with version negotiation)

## Why It Matters

Traditional ML pipelines produce non-deterministic results. Reach solves this by:

1. **Fixed-point math** — No floating-point drift across platforms
2. **Canonical serialization** — CBOR with deterministic field ordering
3. **BLAKE3 hashing** — Fast, collision-resistant checksums
4. **Event-sourced replay** — Every decision logged, every log verifiable

This makes Reach suitable for audit-heavy environments where results must be independently verified.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Reach     │────▶│  Requiem    │────▶│   Replay    │
│   CLI/TS    │     │ Engine/C++  │     │  Verifier   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Evidence   │     │   BLAKE3    │     │  Fingerprint│
│  Transcript │     │   Hashing   │     │   Match     │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Smoke Test

Run the command and treat its exit code and emitted checks as authoritative. Output varies by installed toolchain and engine availability; the repository does not promise a fixed duration or version string.

```bash
pnpm verify:smoke
```

## Operator Commands

| Command | Purpose | Exit contract |
|---------|---------|---------------|
| `pnpm reach:health` | Read-only local repository/runtime health | non-zero when a required check fails |
| `pnpm reach:dgl:doctor` | Inspect governance/doctor checks | non-zero on failed checks |
| `pnpm verify:smoke` | Engine, determinism, and protocol smoke verification | non-zero on failure |
| `pnpm verify:rollback` | Exercise the rollback selection path | non-zero on failure |
| `pnpm verify:ops` | Run the local operator verification suite | non-zero on failure |

Evidence is local and machine-readable where the command supports it; no command is proof of hosted availability, customer adoption, or revenue.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ERR_ENGINE_NOT_FOUND` | Run `pnpm install` to build Requiem |
| `ERR_DETERMINISM_MISMATCH` | See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| `ERR_PROTOCOL_VERSION_MISMATCH` | Check `--protocol-version` flag |
| `ERR_CAS_INTEGRITY_FAILURE` | Run `reach doctor --fix-cas` |

## Documentation

- [Go-Live Guide](docs/GO_LIVE.md) — Install, smoke, rollback, debug
- [Troubleshooting](docs/TROUBLESHOOTING.md) — Failure modes and fixes
- [Error Codes](docs/ERROR_CODES.md) — Error meanings and operator actions
- [Security](docs/SECURITY.md) — Threat model and hardening
- [Protocol](docs/PROTOCOL.md) — Frame format and version negotiation
- [Runbooks](docs/ops/) — Operational procedures

## Verification Commands

| Command | Purpose | Time |
|---------|---------|------|
| `pnpm verify:fast` | Lint + typecheck + unit tests | ~30s |
| `pnpm verify:smoke` | Engine + determinism + protocol | ~2m |
| `pnpm verify:oss` | OSS purity + boundaries | ~1m |
| `pnpm verify:determinism` | 200-run stress test | ~5m |

## License

MIT © Reach Contributors
