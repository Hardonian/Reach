# Scaling Posture (Replay/Verify)

## Known breakpoints

- Large artifact catalogs can force full key-materialization via `List` calls.
- Blob writes that are not atomic can leave truncated files under crash/interruption.
- Context cancellation was not consistently checked across long list/write paths.

## Improvements implemented

1. **Atomic blob persistence in SQLite storage driver**
   - Writes now go to temp file + `fsync` + `rename` for crash-safe replacement.
2. **Cancellation propagation in storage hot paths**
   - `Write`, `Read`, and `List` now short-circuit on canceled contexts.
3. **List scan hygiene for larger datasets**
   - Added row error checks and bounded preallocation to reduce repeated growth churn.

These changes do not alter replay/hash semantics; they only harden I/O path behavior.

## Out of scope for v0.1

- End-to-end streaming replay parser for full transcript verification.
- Cross-service pagination contracts for every CLI list consumer.
- Multi-process backpressure orchestration for very large parallel replay farms.

## Scale-safe coding rules

- Prefer streaming/iteration over loading full datasets in memory.
- Always honor `context.Context` cancellation in loops and I/O boundaries.
- Use atomic file replacement for persistence that must survive interruption.
- Keep query ordering explicit (`ORDER BY`) for deterministic output sequences.
