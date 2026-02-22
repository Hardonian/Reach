# CLI Reference — reachctl

Last Updated: 2026-02-22

## Overview

`reachctl` is the primary command-line interface for all Reach operations. It provides deterministic local execution, replay verification, policy management, and artifact lifecycle management.

**Build from source:**
```bash
cd services/runner && go build -ldflags="-s -w" ./cmd/reachctl
```

**Global flags available on all commands:**
- `--json` — Output structured JSON instead of human-readable text.
- `--verbose` — Enable verbose logging.
- `--data-dir <path>` — Override the default data directory (`~/.reach/`).
- `--no-color` — Disable color output.

All commands return structured errors with codes from the [Error Code Registry](ERROR_CODE_REGISTRY.md). Exit code 0 on success, non-zero on any error.

---

## Core Commands

### `reachctl init`

Initialize a new execution pack scaffold in the current directory.

```bash
reachctl init [--name <pack-name>] [--governed] [--json]
```

**Options:**
- `--name <pack-name>` — Pack name (default: directory name)
- `--governed` — Initialize with strict governance policy applied
- `--template <id>` — Use a registered pack template

**Output:**
```
✓ Initialized pack 'my-pack' at ./my-pack/
  manifest.json  ·  policy.json  ·  README.md
```

**JSON output:**
```json
{"status":"success","pack_name":"my-pack","path":"./my-pack/","files":["manifest.json","policy.json","README.md"]}
```

---

### `reachctl run`

Execute a pack locally.

```bash
reachctl run <pack-name> [--input <json>] [--dry-run] [--json]
```

**Options:**
- `<pack-name>` — Name or path of the pack to run. Checks `~/.reach/packs/` if not found locally.
- `--input <json>` — JSON-encoded input to the pack.
- `--dry-run` — Validate without executing (checks policy + artifact availability).
- `--timeout <duration>` — Override default execution timeout (e.g., `--timeout=60s`).

**Output:**
```
▶ Running pack 'demo-pack'
  run_id: sha256:abc123
  policy: strict-default v1
✓ Completed in 420ms
  fingerprint: sha256:def456
```

**JSON output:**
```json
{"run_id":"sha256:abc123","status":"success","fingerprint":"sha256:def456","duration_ms":420}
```

---

### `reachctl replay`

Replay a previous execution to verify determinism and integrity.

```bash
reachctl replay <run-id> [--verbose] [--json]
```

**Options:**
- `<run-id>` — The run ID to replay. Must exist in the local data directory.
- `--verbose` — Show per-event comparison on divergence.
- `--timeout <duration>` — Override default timeout.

**Output (verified):**
```
▶ Replaying run sha256:abc123
✓ REPLAY_VERIFIED
  Original fingerprint:  sha256:def456
  Replay fingerprint:    sha256:def456
  Events replayed: 17
```

**Output (diverged):**
```
▶ Replaying run sha256:abc123
✗ REPLAY_DIVERGED
  Original fingerprint:  sha256:def456
  Replay fingerprint:    sha256:xxxxxx
  Divergence at: event #5 (tool.responded)
  Run 'reachctl diff-run' for details
```

**Error codes:** `RL-2001` (mismatch), `RL-2003` (engine version), `RL-3001` (missing artifacts)

---

### `reachctl doctor`

Run environment health diagnostics.

```bash
reachctl doctor [--json]
```

Checks:
- Go runtime version
- Rust/engine binary availability
- SQLite version
- `~/.reach/` directory accessibility and permissions
- Network connectivity (optional, for cloud mode)
- Policy bundle integrity

**Output:**
```
Reach Doctor
─────────────────────────────
✓  Go:     1.22.7
✓  SQLite: 3.45.0
✓  Data:   ~/.reach/ (accessible)
✓  Policy: strict-default v1 (valid)
⚠  Rust:   not found (optional for Rust engine)

1 warning · 0 errors
```

---

### `reachctl explain-failure`

Explain why a run failed with actionable guidance.

```bash
reachctl explain-failure <run-id> [--json]
```

**Output:**
```
Run sha256:abc123 failed with: RL-1001 PolicyDenied

  Rule:       capability-check (evaluation_order: 1)
  Reason:     tool 'disallowed-tool' is not in the capability allowlist
  Suggestion: Add the tool to the capability allowlist in your pack manifest.

  View the full event log: reachctl logs sha256:abc123
```

**Error codes:** `RL-1001` (policy denied), `RL-3001` (run not found)

---

### `reachctl export`

Export a run as a portable capsule bundle.

```bash
reachctl export <run-id> [--output <path>] [--json]
```

Creates a `.reach.zip` file containing all artifacts needed for replay on another machine.

**Output:**
```
✓ Exported run sha256:abc123
  → ./sha256-abc123.reach.zip (2.4 MB)
  Contains: meta.json, events.ndjson, artifacts/, policy.json
```

---

### `reachctl import`

Import a portable capsule bundle.

```bash
reachctl import <path-to-bundle.reach.zip> [--json]
```

**Output:**
```
✓ Imported run sha256:abc123
  Stored at: ~/.reach/runs/sha256:abc123/
  Ready for replay: reachctl replay sha256:abc123
```

---

### `reachctl gc`

Garbage collect expired run data.

```bash
reachctl gc [--older-than <duration>] [--dry-run] [--json]
```

**Options:**
- `--older-than <duration>` — Remove runs older than this duration (default: 30d).
- `--dry-run` — Show what would be removed without deleting.

**Output:**
```
✓ GC complete: removed 12 runs (145 MB freed)
  Oldest kept: 30 days ago
```

---

### `reachctl data-dir`

Print the canonical data directory path.

```bash
reachctl data-dir [--json]
```

**Output:**
```
/home/user/.reach
```

---

### `reachctl benchmark`

Measure execution performance and resource usage.

```bash
reachctl benchmark [--pack <name>] [--trials <n>] [--json]
```

**Output:**
```
Benchmark: demo-pack (3 trials)
──────────────────────────────────────────
  Trial 1:  382ms  ·  12MB peak  ·  47 events
  Trial 2:  391ms  ·  12MB peak  ·  47 events
  Trial 3:  388ms  ·  12MB peak  ·  47 events
──────────────────────────────────────────
  Avg:      387ms  ·  P99: 391ms
  Status:   PASS (all fingerprints match)
```

Results stored at `~/.reach/benchmarks/`.

---

### `reachctl verify-determinism`

Run the same pack N times and assert all fingerprints are identical.

```bash
reachctl verify-determinism [--n <count>] [--pack <name>] [--json]
```

**Options:**
- `--n <count>` — Number of runs (default: 5, minimum: 2).
- `--pack <name>` — Pack to test (default: demo-pack if available).

**Output (pass):**
```
Determinism verification: demo-pack (5 runs)
✓ All 5 fingerprints match: sha256:def456
  Run IDs: sha256:abc001, sha256:abc002, ... sha256:abc005
```

**Output (fail):**
```
✗ Determinism violation detected!
  Run 3 fingerprint: sha256:xxxxxx
  Expected:          sha256:def456
  Run 'reachctl diff-run sha256:abc001 sha256:abc003' to investigate.
```

**Error codes:** `RL-2001` (fingerprint mismatch)

---

### `reachctl diff-run`

Compare two run fingerprints and event logs.

```bash
reachctl diff-run <run-id-A> <run-id-B> [--json]
```

**Output:**
```
diff-run sha256:abc001 sha256:abc003
──────────────────────────────────────────
  run_id:          match ✓
  engine_version:  match ✓
  policy_version:  match ✓
  input_hash:      match ✓
  event_log_hash:  MISMATCH ✗
    A: sha256:aabbcc
    B: sha256:xxyyzz
  fingerprint:     MISMATCH ✗

  First divergent event: #5 (tool.responded)
    A: {"tool":"list","output":{"items":["a","b","c"]}}
    B: {"tool":"list","output":{"items":["c","a","b"]}}
  
  Likely cause: tool response order not deterministic.
  Fix: ensure tool responses are sorted before inclusion in event log.
```

See [`docs/REPLAY_DIFF_SPEC.md`](REPLAY_DIFF_SPEC.md) for full output format specification.

---

## Additional Commands

### `reachctl logs <run-id>`

Stream the event log for a run.

```bash
reachctl logs <run-id> [--follow] [--json]
```

### `reachctl list`

List all stored runs.

```bash
reachctl list [--limit <n>] [--status <success|failed>] [--json]
```

### `reachctl validate-policy <path>`

Validate a policy bundle against the schema.

```bash
reachctl validate-policy path/to/policy.json [--json]
```

### `reachctl version`

Print version information.

```bash
reachctl version [--json]
```

---

## Error Handling

All commands return structured errors in this format (when `--json` is used):

```json
{
  "code": "RL-XXXX",
  "category": "PolicyFailure | StorageError | DeterminismError | CloudDisabled",
  "message": "Human-readable error message",
  "suggestion": "Actionable guidance",
  "deterministic": true
}
```

See [`docs/ERROR_CODE_REGISTRY.md`](ERROR_CODE_REGISTRY.md) for the full error code list.

---

## Related Documents

- [`docs/ERROR_CODE_REGISTRY.md`](ERROR_CODE_REGISTRY.md) — All RL-XXXX error codes
- [`docs/REPLAY_PROTOCOL.md`](REPLAY_PROTOCOL.md) — Replay algorithm and verification
- [`docs/STORAGE_MODEL.md`](STORAGE_MODEL.md) — Where run data is stored
- [`docs/BENCHMARKING.md`](BENCHMARKING.md) — Benchmark usage and CI integration
- [`docs/DETERMINISM_DEBUGGING.md`](DETERMINISM_DEBUGGING.md) — Debugging divergences
