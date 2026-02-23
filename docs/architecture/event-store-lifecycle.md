# Event Store Lifecycle

Last Updated: 2026-02-23

## Purpose

This document defines the lifecycle of events in the Reach event store —
from creation through compaction, snapshotting, and pruning. It establishes
the invariants that must hold to preserve hash chain integrity under all
lifecycle operations.

---

## 1. Event Store Architecture

### Storage Backend

The event store uses SQLite with WAL mode for concurrency. The schema is
defined across sequential migrations:

```text
migrations/001_init.sql          — runs, events, audit, sessions tables
migrations/002_orchestration.sql — jobs, job_attempts, nodes tables
migrations/003_hardware.sql      — hardware attestation columns
migrations/004_replay.sql        — fingerprint column on runs
migrations/005_snapshots.sql     — snapshots table
```

### Core Tables

| Table       | Purpose                                | Key Fields                          |
| :---------- | :------------------------------------- | :---------------------------------- |
| `runs`      | Run metadata and fingerprint           | id, tenant_id, status, fingerprint  |
| `events`    | Ordered event stream per run           | id (auto), run_id, type, payload    |
| `snapshots` | Compacted state at a point in time     | run_id, last_event_id, state_payload|
| `audit`     | Immutable audit trail per tenant       | tenant_id, run_id, type, payload    |

### Event Ordering

Events are ordered by `id` (INTEGER PRIMARY KEY AUTOINCREMENT). This provides
a strict total order within a single SQLite database. The `created_at`
timestamp is informational only and MUST NOT be used for ordering.

**Invariant**: Event IDs are monotonically increasing within a run. There are
no gaps.

---

## 2. Write Path

### Event Append

```go
storage.EventsStore.AppendEvent(ctx, EventRecord) → (id, error)
```

1. The event is inserted into the `events` table.
2. SQLite assigns the next auto-increment ID.
3. The event ID is returned to the caller.
4. The caller is responsible for including the event in the hash chain.

**Invariant**: All event appends occur within a single goroutine per run.
There is no concurrent append to the same run.

### Run Fingerprint

```go
storage.RunsStore.SetFingerprint(ctx, runID, fingerprint) → error
```

After all events for a run are collected and the final hash is computed,
the fingerprint is committed to the `runs` table. This is a single UPDATE
statement — atomic within SQLite.

---

## 3. Read Path

### Event Listing

```go
storage.EventsStore.ListEvents(ctx, runID, tenantID, afterID) → ([]EventRecord, error)
```

Events are returned ordered by `id ASC`. This is guaranteed by the schema's
primary key ordering and the explicit ORDER BY in the query.

**Invariant**: `ListEvents` always returns events in the same order for the
same run. This is what makes replay deterministic.

---

## 4. Snapshot Lifecycle

### Creating a Snapshot

```go
storage.EventsStore.SaveSnapshot(ctx, SnapshotRecord) → (id, error)
```

A snapshot captures the compacted state of a run at a specific event ID.

| Field            | Description                                        |
| :--------------- | :------------------------------------------------- |
| `run_id`         | The run this snapshot belongs to                   |
| `last_event_id`  | The ID of the last event included in this snapshot |
| `state_payload`  | Serialized JSON of the compacted state             |
| `created_at`     | Timestamp of snapshot creation                     |

**Invariant**: `state_payload` is the canonical JSON representation of the
run state computed by replaying events `[1..last_event_id]`. If the same
events are replayed, the same `state_payload` MUST be produced.

### Retrieving the Latest Snapshot

```go
storage.EventsStore.GetLatestSnapshot(ctx, runID) → (SnapshotRecord, error)
```

Returns the most recent snapshot for a run (by `created_at DESC`).

---

## 5. Pruning Lifecycle

### Event Pruning

```go
storage.EventsStore.PruneEvents(ctx, runID, beforeEventID) → (pruned_count, error)
```

Deletes events with `id < beforeEventID` for the given run.

### Pruning Safety Invariants

1. **Snapshot-before-prune**: A snapshot MUST exist with
   `last_event_id >= beforeEventID - 1` before any pruning occurs. This
   ensures the pruned events can be reconstructed from the snapshot.

2. **Hash chain preservation**: The fingerprint stored in `runs.fingerprint`
   was computed from the complete event sequence. After pruning, replay must:
   - Load the latest snapshot.
   - Replay only events with `id >= snapshot.last_event_id + 1`.
   - The final hash MUST still match `runs.fingerprint`.

3. **No partial prune within a hash boundary**: If events contribute to an
   intermediate hash (e.g., a step-level hash), the prune boundary must align
   with step boundaries, not arbitrary event IDs.

### Pruning Algorithm

```text
1. snapshot = GetLatestSnapshot(runID)
2. if snapshot == nil:
     return error("cannot prune without snapshot")
3. if beforeEventID > snapshot.last_event_id + 1:
     return error("prune boundary exceeds snapshot coverage")
4. count = DELETE FROM events WHERE run_id = ? AND id < ?
5. return count
```

---

## 6. Replay with Compaction

### Full Replay (No Snapshots)

```text
events = ListEvents(runID, tenantID, afterID=0)
state = replay_all(events)
hash = compute_hash(state)
assert hash == runs.fingerprint
```

### Resumable Replay (With Snapshots)

```text
snapshot = GetLatestSnapshot(runID)
if snapshot exists:
  state = deserialize(snapshot.state_payload)
  events = ListEvents(runID, tenantID, afterID=snapshot.last_event_id)
  state = replay_from(state, events)
else:
  events = ListEvents(runID, tenantID, afterID=0)
  state = replay_all(events)

hash = compute_hash(state)
assert hash == runs.fingerprint
```

**Invariant**: Full replay and resumable replay MUST produce the same final
hash. This is the **replay equivalence guarantee**.

---

## 7. Memory Growth Analysis

### Growth Curve

Without pruning, storage grows linearly with the number of events:

```text
Size = N_events × avg_event_size + N_runs × run_metadata_size
```

Typical event sizes:

- `spec_loaded`: ~2–5 KB
- `evidence_submitted`: ~0.5–2 KB
- `evaluation_completed`: ~1–3 KB
- `transcript_exported`: ~3–10 KB

### Growth Projections

| Events/Day | Event Avg Size | Daily Growth | Monthly Growth |
| :--------- | :------------- | :----------- | :------------- |
| 100        | 2 KB           | 200 KB       | 6 MB           |
| 1,000      | 2 KB           | 2 MB         | 60 MB          |
| 10,000     | 2 KB           | 20 MB        | 600 MB         |
| 100,000    | 2 KB           | 200 MB       | 6 GB           |

### Mitigation Strategy

1. **Periodic snapshots**: Create snapshots every N events (default: 1000).
2. **Prune with retention window**: Keep the last 7 days of raw events;
   older events are pruned after snapshotting.
3. **Audit table is append-only**: The audit table is never pruned. It serves
   as the compliance record.

---

## 8. Transaction Boundary Safety

### SQLite Transaction Guarantees

- WAL mode is enabled (`PRAGMA journal_mode=WAL`).
- Each write operation (`AppendEvent`, `SaveSnapshot`, `PruneEvents`) executes
  as a single SQL statement, which is atomic in SQLite.
- Compound operations (snapshot-then-prune) are NOT wrapped in an explicit
  transaction in the current implementation.

### Risk: Non-Atomic Snapshot + Prune

**Current State**: `SaveSnapshot` and `PruneEvents` are called sequentially
without a wrapping transaction. If the process crashes between snapshot and
prune, the state is still consistent (events remain unpruned). However, if
the prune succeeds but the snapshot write was lost (shouldn't happen with WAL),
data loss would occur.

**Recommendation**: Wrap snapshot + prune in `BEGIN IMMEDIATE ... COMMIT`
for defense-in-depth.

---

## 9. Formal Invariants

| ID      | Invariant                                             | Status   |
| :------ | :---------------------------------------------------- | :------- |
| EVT-01  | Events ordered by monotonic auto-increment ID         | HOLDS    |
| EVT-02  | Snapshot state ≡ replay of events [1..last_event_id]  | HOLDS    |
| EVT-03  | Pruning requires snapshot coverage                    | HOLDS    |
| EVT-04  | Full replay hash == resumable replay hash             | ASSUMED  |
| EVT-05  | Audit table is append-only (never pruned)             | HOLDS    |
| EVT-06  | WAL mode enabled for concurrency safety               | HOLDS    |
| EVT-07  | Snapshot + prune is atomic                            | **RISK** |
