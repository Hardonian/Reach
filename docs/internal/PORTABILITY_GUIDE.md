# Portability Guide

Last Updated: 2026-02-22

## Overview

Reach runs are portable. Any run can be exported as a self-contained capsule bundle (`.reach.zip`) and re-imported on any machine for replay verification, audit, or debugging.

---

## Export — Creating a Portable Capsule

```bash
# Export a specific run
reachctl export <run-id>

# Export to a specific path
reachctl export <run-id> --output /tmp/my-run-audit.reach.zip

# JSON output
reachctl export <run-id> --json
```

### Bundle Contents

A `.reach.zip` bundle contains:

```text
<run-id>.reach.zip
├── meta.json           # Run manifest with fingerprint and all hashes
├── logs/
│   └── events.ndjson   # Complete ordered event log
└── artifacts/
    ├── inputs.json     # Canonical-JSON of all inputs
    ├── pack.zip        # Exact pack version used
    └── policy.json     # Policy bundle snapshot
```

The bundle is self-contained: importing it provides everything needed for `reachctl replay`.

---

## Import — Ingesting a Capsule

```bash
# Import a capsule bundle
reachctl import ./my-run-audit.reach.zip

# Verify after import
reachctl replay <run-id>
```

On import:

1. Bundle is extracted to `~/.reach/runs/<run_id>/`.
2. Fingerprint is verified against `meta.json.fingerprint`.
3. Event log hash is verified.
4. Run is indexed in `reach.db`.

If verification fails, the import is rejected with `RL-2001`.

---

## Capsule CLI (Canonical)

Use the canonical capsule syntax:

```bash
# Create a capsule from a run
reachctl capsule create <run-id>

# Verify capsule integrity
reachctl capsule verify data/capsules/<run-id>.capsule.json

# Replay capsule deterministically
reachctl capsule replay data/capsules/<run-id>.capsule.json
```

Legacy aliases `export` and `import` are still supported with a deprecation warning.

---

## Cross-Platform Compatibility

| Platform         | Support                     |
| :--------------- | :-------------------------- |
| Linux x64        | Tier 1 — Full support       |
| macOS x64/ARM    | Tier 1 — Full support       |
| Windows x64      | Tier 2 — Full support       |
| Linux ARM64      | Tier 2 — Full support       |
| Android (Termux) | Tier 2 — Core features      |
| iOS              | Tier 3 — Via UniFFI binding |

### Path Normalization

To ensure portability across platforms, all paths in the bundle use forward slashes (`/`). Windows-specific paths are normalized on export.

---

## CI Integration

To verify a run in CI:

```yaml
# GitHub Actions example
- name: Import and verify Reach run
  run: |
    reachctl import ./artifacts/run-bundle.reach.zip
    reachctl replay <run-id> --json | jq -e '.match == true'
```

---

## Migration Between Environments

### Complete Data Migration

```bash
# On source machine: export all runs
for run_id in $(reachctl list --json | jq -r '.[].run_id'); do
  reachctl export "$run_id" --output "./migration/$run_id.reach.zip"
done

# On target machine: import all
for f in ./migration/*.reach.zip; do
  reachctl import "$f"
done
```

### Verify Migration

```bash
# Verify all imported runs
reachctl list --json | jq -r '.[].run_id' | xargs -I{} reachctl replay {} --json | jq -r '.status'
```

All should report `REPLAY_VERIFIED`.

---

## Storage and Environment Variables

| Variable          | Default    | Description                |
| :---------------- | :--------- | :------------------------- |
| `REACH_DATA_DIR`  | `~/.reach` | Override data directory    |
| `REACH_HOME`      | `~/.reach` | Alias for `REACH_DATA_DIR` |
| `REACH_LOG_LEVEL` | `info`     | Log verbosity              |

---

## Related Documents

- [`docs/STORAGE_MODEL.md`](STORAGE_MODEL.md) — Full storage schema
- [`docs/CLI_REFERENCE.md`](CLI_REFERENCE.md) — Export/import commands
- [`docs/REPLAY_INTEGRITY_PROOF.md`](REPLAY_INTEGRITY_PROOF.md) — Integrity proof model
