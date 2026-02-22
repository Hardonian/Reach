# Storage Specification

## Overview
Reach uses a local-first storage model. By default, all data is stored in the user's home directory.

## Directory Structure
Default path: `~/.reach/` (can be overridden via `REACH_HOME` or `REACH_DATA_DIR`)

```text
~/.reach/
├── config.json       # User configuration
├── reach.db         # SQLite database (Runs, Events, Audit)
├── packs/           # Cached execution packs
├── capsules/        # Signed time capsules (audit artifacts)
├── plugins/         # Installed tool plugins
└── logs/            # Execution logs
```

## Storage Driver Interface (Go)
```go
type StorageDriver interface {
    Put(ctx context.Context, key string, data []byte) error
    Get(ctx context.Context, key string) ([]byte, error)
    Delete(ctx context.Context, key string) error
    List(ctx context.Context, prefix string) ([]string, error)
}
```

## SQLite Schema
The `reach.db` contains:
- `runs`: Metadata for every execution.
- `events`: Deterministic event log for each run.
- `audit`: Immutable proof chain.
- `registry_cache`: Local cache of plugin metadata.

## Governance & GC
- `reachctl gc`: Removes old run data and unused packs.
- `reachctl export <run-id>`: Creates a standalone `.reach.zip` containing everything needed for replay.
