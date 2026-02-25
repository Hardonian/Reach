# Reach CLI Reference

Reach provides two primary CLI interfaces: `reachctl` (the core binary) and the root `./reach` wrapper script (for developer hygiene and cross-tool orchestration).

## Root Wrapper (`./reach`)

The root `./reach` script is the entry point for most developer tasks. It manages dependencies and provides a unified interface for sub-tools.

| Command | Description |
| :--- | :--- |
| `doctor` | Perform a full system health check (Go, Node, Rust, SQLite). |
| `run <pack>` | Quickly execute a deterministic pack locally. |
| `eval` | Evaluate runs and check for regressions against golden fixtures. |
| `audit` | Export and verify signed audit logs for compliance. |
| `capsule` | Create or verify signed execution capsules for long-term storage. |
| `proof` | Verify cryptographic execution proofs (PoEE). |
| `gate` | Manage repository and release gates for CI/CD integration. |
| `cost` | View unit economics and cost analysis for model executions. |
| `metrics` | View GTM and usage analytics for the local node. |
| `wizard` | Guided run wizard optimized for mobile/CLI interaction. |

### Usage Example

```bash
./reach doctor
./reach run security-baseline --json
```

## Workflow CLI

The workflow-specific commands manage long-running decision processes within a `.zeo` workspace.

| Command | Description |
| :--- | :--- |
| `workflow start` | Initialize a new decision workspace with a title and type. |
| `workflow add-note` | Append evidence, observations, or assertions to the decision. |
| `workflow run` | Trigger the decision engine to compute recommended actions. |
| `workflow export` | Export the decision (MD, ICS, or portable bundle). |
| `workflow health` | View health scores, replay stability, and asset volatility. |
| `workflow graph` | Visualize decision dependencies and impact chains. |

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

## Source Control Coherence (SCCL)

| Command | Description |
| :--- | :--- |
| `reach workspace validate` | Validate `reach.workspace.json` against SCCL schema and required gates. |
| `reach workspace show` | Print canonical workspace sync configuration. |
| `reach sync status` | Show local/upstream heads, stale-base state, dirty tree status, and sync plan. |
| `reach sync up` | Reconcile branch against upstream using manifest strategy (`rebase` or `merge`). |
| `reach sync branch --task "<name>"` | Create branch from upstream default using naming policy. |
| `reach sync lease acquire|renew|release|list` | Manage source-application leases to avoid concurrent branch mutation. |
| `reach sync apply --pack <file>` | Apply patch pack under lease and emit run record + conflict report. |
| `reach sync pr --ensure` | Create/update PR metadata artifact for external host PR flow. |
| `reach sync export` | Produce Source Coherence bundle artifacts. |
| `reach sccl gate` | Execute the SCCL gate used by `npm run validate:sccl`. |
