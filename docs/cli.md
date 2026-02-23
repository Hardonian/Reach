# Reach CLI Reference

Reach provides two primary CLI interfaces: `reachctl` (the core binary) and the root `./reach` wrapper script (for developer hygiene and cross-tool orchestration).

## Root Wrapper (`./reach`)

The root `./reach` script is the entry point for most developer tasks. It manages dependencies and provides a unified interface for sub-tools.

| Command      | Description                                                       |
| :----------- | :---------------------------------------------------------------- |
| `doctor`     | Perform a full system health check (Go, Node, Rust, SQLite).      |
| `run <pack>` | Quickly execute a deterministic pack locally.                     |
| `eval`       | Evaluate runs and check for regressions against golden fixtures.  |
| `audit`      | Export and verify signed audit logs for compliance.               |
| `transcript`    | Create or verify signed execution transcripts for long-term storage. |
| `proof`      | Verify cryptographic execution proofs (Execution Proof).                     |
| `gate`       | Manage repository and release gates for CI/CD integration.        |
| `cost`       | View unit economics and cost analysis for model executions.       |
| `metrics`    | View GTM and usage analytics for the local node.                  |
| `wizard`     | Guided run wizard optimized for mobile/CLI interaction.           |

### Usage Example

```bash
./reach doctor
./reach run security-baseline --json
```

## Workflow CLI

The workflow-specific commands manage long-running decision processes within a `.zeo` workspace.

| Command             | Description                                                   |
| :------------------ | :------------------------------------------------------------ |
| `workflow start`    | Initialize a new decision workspace with a title and type.    |
| `workflow add-note` | Append evidence, observations, or assertions to the decision. |
| `workflow run`      | Trigger the decision engine to compute recommended actions.   |
| `workflow export`   | Export the decision (MD, ICS, or portable bundle).            |
| `workflow health`   | View health scores, replay stability, and asset volatility.   |
| `workflow graph`    | Visualize decision dependencies and impact chains.            |

## Installation & Setup

### Core Binary (`reachctl`)

The core binary is built from the Go sources in the runner service.

```bash
cd services/runner
go build -o ../../reachctl ./cmd/reachctl
```

### Mobile/Termux Support

Reach is optimized for mobile execution via Termux.

```bash
bash scripts/install-termux.sh
```

## Global Flags

- `--json`: Output result in machine-readable JSON format for automation.
- `--help`: Display detailed help and flag descriptions for any command.
- `--as-of`: (Workflow) Simulate execution as of a specific UTC date.
