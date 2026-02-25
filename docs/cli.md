# Reach CLI Reference

Reach provides a high-performance CLI for deterministic execution and auditing.

## Command Matrix

| Command      | Purpose                   | Key Flags                    | Example                         |
| ------------ | ------------------------- | ---------------------------- | ------------------------------- |
| `version`    | Show version info         | N/A                          | `reach version`                 |
| `doctor`     | Environment health check  | N/A                          | `reach doctor`                  |
| `demo`       | Run smoke test demo       | `smoke`, `run`               | `reach demo smoke`              |
| `status`     | System & config status    | `--json`                     | `reach status`                  |
| `quickstart` | Bootstrap environment     | `--fixture-mode`             | `reach quickstart`              |
| `bugreport`  | Generate diagnostic zip   | `--output`                   | `reach bugreport`               |
| `capsule`    | Manage execution capsules | `create`, `verify`, `replay` | `reach capsule create <run-id>` |
| `proof`      | Verify execution proofs   | `verify`, `explain`          | `reach proof verify <run-id>`   |
| `packs`      | Manage execution packs    | `search`, `install`          | `reach packs install sentinel`  |

## Core Commands

### reach version

Prints the current version, Go version, and platform. Guaranteed deterministic.
**Exit Codes:** 0 on success.

### reach doctor

Diagnoses the local environment for dependencies (Go, Node, SQLite) and data directory health.
**Exit Codes:** 0 if healthy, 1 if issues found.

### reach demo

One-command flow to verify engine readiness.

```bash
reach demo smoke
```

### reach status

Logs the current operating mode (OSS/Enterprise), active configuration, and database connectivity.

```bash
reach status
```

### reach bugreport

Generates a sanitized ZIP bundle containing logs, environment metadata (redacted), and system status for troubleshooting.

```bash
reach bugreport --output diagnostic.zip
```

### reach capsule

The foundation of Reach's portability.

- `create <run-id>`: Export a run to a portable JSON capsule.
- `verify <file>`: Cryptographically verify a capsule's integrity.
- `replay <file>`: Perform a bit-perfect replay of the capsule.

## Installation

See [docs/INSTALL.md](./INSTALL.md).
