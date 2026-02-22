# Reach CLI Guide (`reachctl`)

The Reach CLI is the primary interface for managing deterministic agent executions locally.

## Installation

The CLI is built from `services/runner/cmd/reachctl`. You can build it using:

```bash
npm run verify:cli
```

Or manually:

```bash
cd services/runner
go build ./cmd/reachctl
```

## Core Commands

### `reach doctor`

Diagnoses your local environment to ensure all dependencies (Go, Node, SQLite) are met and the data directory is accessible.

### `reach init pack --governed`

Initializes a new execution pack with default governance policies.

### `reach run <pack-name>`

Executes a pack locally. If the pack is not found, it checks `~/.reach/packs/`.

### `reach replay <runId|capsule>`

Replays a previous execution to verify determinism and integrity.

### `reach explain <runId>`

Provides a detailed explanation of a run's failure or outcome based on the event log and policy evaluations.

### `reach data-dir`

Prints the absolute path to the current Reach data directory.

## Advanced Usage

### `reach mesh on|off|status`

Toggles local P2P mesh networking for cross-device coordination.

### `reach capsule create|verify`

Manages signed execution capsules for long-term audit storage.

### `reach graph export <runId>`

Exports the execution graph in SVG or DOT format for visualization.
