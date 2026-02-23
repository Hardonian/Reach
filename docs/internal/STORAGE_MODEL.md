# Storage Model — Reach V1

Last Updated: 2026-02-22

## Overview

Reach uses a local-first storage model. All run data, artifacts, and benchmarks are stored on the local filesystem in a deterministic directory structure. Cloud storage is an optional adapter for enterprise deployments only.

---

## Directory Layout

Default root: `~/.reach/` (overridable via `REACH_DATA_DIR` or `REACH_HOME`)

```
~/.reach/
├── config.json                  # User configuration
├── reach.db                     # SQLite database (WAL mode enabled)
├── runs/
│   └── <run_id>/                # One directory per run
│       ├── meta.json            # Run manifest (fingerprint, versions, hashes)
│       ├── artifacts/
│       │   ├── pack.zip         # The exact pack version used
│       │   ├── inputs.json      # Canonical-JSON serialization of inputs
│       │   └── policy.json      # Policy bundle snapshot
│       └── logs/
│           └── events.ndjson    # Ordered event log (NDJSON format)
├── packs/                       # Cached execution packs
│   └── <pack-id>/
│       ├── manifest.json
│       └── pack.zip
├── capsules/                    # Signed time capsule archives
│   └── <capsule-id>.reach.zip
├── benchmarks/                  # Benchmark results
│   └── <bench-timestamp>.json
└── logs/
    └── reach.log                # Global operational log
```

---

## SQLite Schema

The `reach.db` SQLite database stores indexed metadata for fast querying. All canonical data lives on the filesystem; the database is a derived index and can be rebuilt from the filesystem.

### WAL Mode

```sql
PRAGMA journal_mode = WAL;
PRAGMA wal_autocheckpoint = 100;
PRAGMA busy_timeout = 5000;
```

WAL (Write-Ahead Logging) is enabled to support safe concurrent reads while a write is in progress.

### Schema Version

```sql
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);
```

Schema migrations are versioned and applied in sequence. Rollback is supported.

### Core Tables

```sql
CREATE TABLE IF NOT EXISTS runs (
    run_id          TEXT PRIMARY KEY,
    pack_id         TEXT NOT NULL,
    engine_version  TEXT NOT NULL,
    policy_version  TEXT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('success','failed','denied','timeout')),
    fingerprint     TEXT NOT NULL,
    input_hash      TEXT NOT NULL,
    output_hash     TEXT,
    event_log_hash  TEXT NOT NULL,
    created_at      TEXT NOT NULL,     -- ISO 8601 UTC, for display only
    duration_ms     INTEGER
);

CREATE TABLE IF NOT EXISTS events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          TEXT NOT NULL REFERENCES runs(run_id),
    seq             INTEGER NOT NULL,
    event_type      TEXT NOT NULL,
    payload         TEXT NOT NULL,     -- JSON
    timestamp_epoch INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS artifacts (
    artifact_id     TEXT PRIMARY KEY,
    run_id          TEXT NOT NULL REFERENCES runs(run_id),
    artifact_type   TEXT NOT NULL,     -- 'pack' | 'policy' | 'input' | 'output'
    sha256          TEXT NOT NULL,
    path            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS benchmarks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    pack_id         TEXT NOT NULL,
    run_ids         TEXT NOT NULL,     -- JSON array
    trials          INTEGER NOT NULL,
    avg_duration_ms INTEGER NOT NULL,
    p99_duration_ms INTEGER NOT NULL,
    all_match       INTEGER NOT NULL,  -- 1 = all fingerprints match
    fingerprint     TEXT NOT NULL,
    created_at      TEXT NOT NULL
);
```

---

## StorageDriver Interface (Go)

All storage operations go through the `StorageDriver` interface, enabling backend-agnostic code:

```go
type StorageDriver interface {
    // Run operations
    PutRun(ctx context.Context, run *RunRecord) error
    GetRun(ctx context.Context, runID string) (*RunRecord, error)
    ListRuns(ctx context.Context, opts ListRunsOptions) ([]*RunRecord, error)

    // Event log operations
    AppendEvent(ctx context.Context, runID string, event *RunEvent) error
    GetEventLog(ctx context.Context, runID string) ([]*RunEvent, error)

    // Artifact operations
    PutArtifact(ctx context.Context, art *Artifact) error
    GetArtifact(ctx context.Context, artifactID string) (*Artifact, error)

    // Lifecycle
    GC(ctx context.Context, olderThan time.Duration) (int, error)
    Close() error
}
```

**Implementations:**

- `SqliteDriver` — OSS default. SQLite + local filesystem.
- `CloudStorageDriver` — Enterprise only (REACH_CLOUD=1). Cloud object storage backend.

---

## Data Integrity Rules

1. **Filesystem is canonical**: The SQLite database is an index only. All fingerprint verification uses the raw files.
2. **Write-once for `logs/events.ndjson`**: Events are appended only. No event record may be modified after writing.
3. **Immutable artifacts**: Files in `runs/<run_id>/artifacts/` are never overwritten after creation.
4. **WAL prevents corruption**: WAL mode ensures no partial writes reach the database.

---

## Garbage Collection

`reachctl gc` prunes old run data:

```bash
# Remove runs older than 30 days (default)
reachctl gc

# Preview without deleting
reachctl gc --dry-run --older-than 7d

# JSON output
reachctl gc --json
```

GC preserves:

- The 100 most recent runs regardless of age.
- Any run that has been exported to a capsule.
- Any run explicitly marked as `keep`.

---

## Export & Import

See [`docs/PORTABILITY_GUIDE.md`](PORTABILITY_GUIDE.md) for full export/import details.

```bash
# Export a run as a portable capsule
reachctl export <run-id> --output ./my-run.reach.zip

# Import a capsule
reachctl import ./my-run.reach.zip
```

---

## Data Migration

When the schema version changes, migrations are applied automatically on startup:

```
services/runner/internal/storage/migrations/
├── 001_initial.sql
├── 002_add_benchmarks.sql
└── 003_add_artifacts_index.sql
```

Each migration is idempotent and reversible.

---

## Related Documents

- [`docs/PORTABILITY_GUIDE.md`](PORTABILITY_GUIDE.md) — Export/import guide
- [`docs/CLI_REFERENCE.md`](CLI_REFERENCE.md) — Storage-related commands
- [`docs/DETERMINISM_SPEC.md`](DETERMINISM_SPEC.md) — How storage relates to fingerprint
