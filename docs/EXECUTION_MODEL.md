# Execution Model Reach executes work through immutable execution packs and deterministic runtime contracts.

## Lifecycle 1. A run is created with tenant-scoped capabilities.
2. Orchestration builds execution envelopes for tools.
3. Policy gates validate requested tools and permissions.
4. Pack integrity and replay guards are enforced.
5. Events are persisted for audit and replay.

## Deterministic guarantees - Stable event sequencing for replay.
- Snapshot/hash checks for replay integrity.
- Pack hash and signature checks for tamper resistance.

## References - `docs/ARCHITECTURE.md`
- `docs/POLICY_GATE.md`
- `RUN_CAPSULES_REPLAY.md`
