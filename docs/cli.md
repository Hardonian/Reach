# Reach CLI Reference

Reach provides a high-performance CLI for deterministic execution and auditing.

> **Note**: This documentation covers the most common commands. For a complete list of all 40+ commands, run `reach --help`.

## Command Matrix

### Core Commands

| Command      | Purpose                  | Key Flags         | Example            |
| ------------ | ------------------------ | ----------------- | ------------------ |
| `version`    | Show version info        | N/A               | `reach version`    |
| `doctor`     | Environment health check | `--json`, `--fix` | `reach doctor`     |
| `demo`       | Run smoke test demo      | `smoke`, `run`    | `reach demo smoke` |
| `status`     | System & config status   | `--json`          | `reach status`     |
| `quickstart` | Bootstrap environment    | `--fixture-mode`  | `reach quickstart` |
| `bugreport`  | Generate diagnostic zip  | `--output`        | `reach bugreport`  |

### Execution Commands

| Command   | Purpose                 | Key Flags                    | Example                        |
| --------- | ----------------------- | ---------------------------- | ------------------------------ |
| `run`     | Quick run a pack        | N/A                          | `reach run my-pack`            |
| `replay`  | Replay a run            | N/A                          | `reach replay run-123`         |
| `capsule` | Manage capsules         | `create`, `verify`, `replay` | `reach capsule create run-123` |
| `proof`   | Verify execution proofs | `verify`, `explain`          | `reach proof verify run-123`   |

### Cloud Commands

| Command     | Purpose                 | Key Flags                  | Example                |
| ----------- | ----------------------- | -------------------------- | ---------------------- |
| `login`     | Authenticate with cloud | `--token`, `--browser`     | `reach login`          |
| `logout`    | Clear credentials       | `--all`                    | `reach logout`         |
| `org`       | Manage organizations    | `list`, `select`           | `reach org list`       |
| `cloud`     | Cloud status            | `status`                   | `reach cloud status`   |
| `api-key`   | Manage API keys         | `list`, `create`, `revoke` | `reach api-key list`   |
| `artifacts` | Manage artifacts        | `list`, `export`, `sync`   | `reach artifacts list` |

### Evaluation Commands

| Command              | Purpose          | Key Flags                | Example                         |
| -------------------- | ---------------- | ------------------------ | ------------------------------- |
| `eval`               | Run evaluations  | `run`, `compare`, `list` | `reach eval run --pack my-pack` |
| `verify-determinism` | Verify stability | `--trials`               | `reach verify-determinism`      |
| `diff-run`           | Compare two runs | N/A                      | `reach diff-run run-a run-b`    |

### Pack Commands

| Command | Purpose      | Key Flags           | Example                             |
| ------- | ------------ | ------------------- | ----------------------------------- |
| `packs` | Manage packs | `search`, `install` | `reach packs install sentinel`      |
| `gate`  | Policy gates | `run`, `list`       | `reach gate run --policy integrity` |

---

## Core Commands

### reach version

Prints the current version, Go version, and platform. Guaranteed deterministic.

```bash
$ reach version
Reach Deterministic Execution Fabric
  Version:    v0.3.3
  Go Version: go1.21.0
  Platform:   darwin/arm64
```

**Exit Codes:** 0 on success.

---

### reach doctor

Diagnoses the local environment for dependencies (Go, Node, SQLite) and data directory health.

```bash
$ reach doctor
reach doctor (darwin/arm64)
✓ git installed
✓ go installed (1.21.0)
✓ node installed (20.9.0)
✓ reach.db accessible
```

With `--fix` flag, attempts to automatically fix common issues.

**Exit Codes:** 0 if healthy, 1 if issues found.

---

### reach demo

One-command flow to verify engine readiness.

```bash
# Quick smoke test
$ reach demo smoke
✓ Determinism verified
✓ Capsule created
✓ Replay verified

# Full demo with run
$ reach demo run
Running demo pack...
Run ID: demo-123456
Status: COMPLETE
```

---

### reach status

Shows the current operating mode (OSS/Enterprise), active configuration, and database connectivity.

```bash
$ reach status
Mode: OSS
Storage: ✓ reachable
Registry: ✓ 12 packs
Determinism: ✓ WASM available
```

Use `--json` for machine-readable output.

---

### reach quickstart

Bootstraps a new Reach environment with demo packs and sample configurations.

```bash
$ reach quickstart
Initializing deterministic local artifacts...
✓ Data directory: ./data
✓ Demo pack created
✓ Sample run completed
Next: reach run my-pack
```

---

### reach bugreport

Generates a sanitized ZIP bundle containing logs, environment metadata (redacted), and system status for troubleshooting.

```bash
$ reach bugreport --output diagnostic.zip
Bug report: diagnostic.zip
Contains: logs, env metadata (redacted), system status
```

---

## Execution Commands

### reach run

Quickly runs a pack locally.

```bash
$ reach run my-pack
Run ID: run-456
Status: COMPLETE
Output: {...}
```

---

### reach replay

Replays a previous run for verification.

```bash
$ reach replay run-123
Replaying run-123...
✓ Replay verified (100% match)
```

---

### reach capsule

Manages execution capsules—portable, verifiable execution records.

```bash
# Create a capsule from a run
$ reach capsule create run-123 --output my-run.capsule.json
{"capsule": "my-run.capsule.json", "run_id": "run-123", "fingerprint": "abc123..."}

# Verify capsule integrity
$ reach capsule verify my-run.capsule.json
{"verified": true, "run_fingerprint": "abc123..."}

# Replay a capsule
$ reach capsule replay my-run.capsule.json
{"run_id": "run-123", "replay_verified": true, "steps": 42}
```

---

### reach proof

Verifies and explains execution proofs.

```bash
# Verify a proof
$ reach proof verify run-123
{"run_id": "run-123", "deterministic": true, "audit_root": "sha256:..."}

# Explain a proof step-by-step
$ reach proof explain run-123 --step 0
Step 0: Input canonicalization
  Input fingerprint: sha256:...
  Policy gate: integrity-shield
  Result: PASS
```

---

## Cloud Commands

### reach login

Authenticates with Reach Cloud. Supports interactive OAuth and token-based authentication.

```bash
# Interactive login (opens browser)
$ reach login
Your authentication code: XXXX-XXXX
Visit: https://reach.dev/auth/device
✓ Logged in as user@company.com
  Org: my-org

# Token-based login (CI/CD)
$ reach login --token $REACH_API_TOKEN
✓ Logged in as user@company.com
```

---

### reach logout

Clears local credentials.

```bash
# Local logout
$ reach logout
✓ Logged out

# Revoke all sessions
$ reach logout --all
✓ Logged out
  All sessions revoked
```

---

### reach org

Manages organizations for team collaboration.

```bash
# List organizations
$ reach org list
my-org (active) - Pro Plan
other-org - OSS

# Switch organization
$ reach org select other-org
✓ Switched to other-org
```

---

### reach cloud

Shows cloud connection and quota status.

```bash
$ reach cloud status
Reach Cloud Status:
  API: ✓ Reachable
  Auth: ✓ Logged in as user@example.com
  Plan: Pro
  Org:  my-org
  Quota: 450/1000 runs
```

---

### reach api-key

Manages API keys for programmatic access.

```bash
# List API keys
$ reach api-key list
API Keys:
  key-001 - Production CI
    Created: 2026-01-15 | Last used: 2026-02-24

# Create new key
$ reach api-key create "CI/CD Pipeline"
✓ API Key created: CI/CD Pipeline
  ID: key-new
  Token: reach_live_xxxxxxxx
⚠️  Store this token securely - it won't be shown again

# Revoke key
$ reach api-key revoke key-001
✓ API Key revoked: key-001
```

---

### reach artifacts

Manages execution artifacts.

```bash
# List artifacts
$ reach artifacts list
Artifacts:
  run-123 [local] - 2026-02-25 (1.2MB)
  run-456 [cloud] - 2026-02-24 (890KB)

# Export to ZIP
$ reach artifacts export run-123
Exporting run-123...
✓ Exported to data/exports/run-123.zip

# Sync to cloud
$ reach artifacts sync
Syncing artifacts to cloud...
✓ 3 artifacts uploaded
```

---

## Evaluation Commands

### reach eval

Runs and compares evaluations.

```bash
# Run evaluation
$ reach eval run --pack my-pack --dataset test-suite
Evaluation Run: eval-1700000000
Pack: my-pack
Results: 45/45 passed

# Compare evaluations
$ reach eval compare eval-001 eval-002
Comparing eval-001 vs eval-002...
Differences: 2
  Step 3: output modified
  Step 7: latency +15%

# List recent evaluations
$ reach eval list
Recent Evaluations:
  eval-001 - sentinel (passed)
  eval-002 - sentinel (passed)
  eval-003 - integrity (running)
```

---

### reach verify-determinism

Verifies that runs are deterministic by executing multiple trials.

```bash
$ reach verify-determinism --trials 3
Running 3 trials...
Trial 1: ✓ fingerprint match
Trial 2: ✓ fingerprint match
Trial 3: ✓ fingerprint match
✓ Determinism verified
```

---

## Pack Commands

### reach packs

Manages execution packs from the registry.

```bash
# Search packs
$ reach packs search sentinel
Found: sentinel-v1.2.0, sentinel-lite-v1.0.0

# Install a pack
$ reach packs install sentinel
✓ Installed sentinel-v1.2.0
```

---

### reach gate

Manages and runs policy gates.

```bash
# Run a gate
$ reach gate run --policy integrity-shield
Gate: integrity-shield
Status: PASSED

# List gates
$ reach gate list
integrity-shield (active)
sentinel-policy (active)
```

---

## Global Flags

| Flag                  | Description                               |
| --------------------- | ----------------------------------------- |
| `--json`              | Output JSON instead of formatted text     |
| `--quiet`             | Suppress non-error output                 |
| `--verbose`           | Show detailed output                      |
| `--trace-determinism` | Enable internal trace logging for hashing |
| `-v, --version`       | Show version information                  |
| `-h, --help`          | Show help message                         |

---

## Exit Codes

| Code | Meaning                     |
| ---- | --------------------------- |
| 0    | Success                     |
| 1    | General failure             |
| 2    | Invalid input / usage error |
| 3    | Resource not found          |
| 4    | Policy blocked              |
| 5    | Verification failed         |
| 6    | Authentication required     |

---

## Environment Variables

| Variable          | Description                             |
| ----------------- | --------------------------------------- |
| `REACH_DATA_DIR`  | Data directory path (default: `./data`) |
| `REACH_API_TOKEN` | API token for cloud authentication      |
| `REACH_ORG_ID`    | Default organization ID                 |
| `REACH_BASE_URL`  | Custom cloud endpoint                   |
| `REACH_LOG_LEVEL` | Log level: debug, info, warn, error     |

---

## Installation

See [docs/INSTALL.md](./INSTALL.md) for installation instructions.

---

## CI/CD Integration

See [docs/ci-cd.md](./ci-cd.md) for CI/CD integration examples.
