# Deterministic Audit Log Spec Deterministic audit events are emitted in sequence for replay:

- `handshake.started|completed|failed`
- `pack.admitted|pack.denied`
- `execution.started|execution.completed|execution.failed`

## Required fields Each event contains:

- `sequence` (monotonic in-memory counter)
- `run_id`
- `pack_id`, `pack_version`, `pack_hash`
- `node_id`, `org_id`
- `policy_version`
- `context_snapshot_hash` (when available)
- UTC `timestamp`
- `decision` and `reasons` for deny paths

## Replay `runner-audit-inspector` reads `audit.trail` events by `run_id`, validates event ordering by `sequence`, and re-computes deterministic policy decisions for pack admission entries.
