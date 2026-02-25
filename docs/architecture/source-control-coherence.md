# Source Control Coherence Layer (SCCL)

## Current control-plane inventory

- **Reach CLI** (`src/cli/reach-cli.ts`) already orchestrates DGL/CPX and can dispatch operational scripts.
- **ReadyLayer Web Console** (`apps/arcade/src/app/governance/*`) exposes governance dashboards and API-backed views.
- **App Backend APIs** (`apps/arcade/src/app/api/*`) provide governance payloads with structured auth failures.
- **Agent execution paths** (`services/runner/*`) execute jobs with lease-like semantics for queue work.
- **IDE integration** (`extensions/vscode/`) exists, but lacked source-coherence contract primitives.
- **Web agents / no-git environments** had DGL/CPX paths, but no unified source-reconciliation protocol.

## Gaps diagnosed

1. No single workspace manifest defining canonical Git SoT policy.
2. No shared sync types for branch divergence, stale-base detection, and conflict classes.
3. Lease handling existed for job queues but not for source patch application.
4. No dedicated SCCL gate tying actor attribution + run records + lease hygiene.
5. Governance UI lacked a source-control coherence panel with events and split-brain alerts.

## SoT rules

- **Source code truth**: Git remote refs (`origin/<default_branch>` and PR refs).
- **Artifact truth**: content-addressed SCCL run records attached to base/head + patch hash.
- Any local workspace (CLI, IDE, agent, web runtime) is **ephemeral** and must reconcile through SCCL.

## SCCL design

### Canonical protocol

1. Resolve `reach.workspace.json`.
2. Discover repo and fetch upstream refs.
3. Compute deterministic `RepoState` and `SyncPlan`.
4. Acquire lease (branch-level default).
5. Validate patch pack freshness (`base_sha` + stale threshold).
6. Apply patch pack and emit conflict report with stable classes.
7. Emit SCCL run record linking DGL/CPX and determinism replay IDs.
8. Ensure PR metadata for review flow.

### No split-brain invariants

- Every applied patch must have attributable actor metadata.
- Every applied patch must produce a run record with base/head/patch hash.
- A branch cannot have multiple active leases.
- Stale-base beyond threshold requires sync/rebase before apply.
- High-risk changes on default branch fail gate when PR flow is required.

## Sequence (text diagram)

`CLI/Web/Agent -> SCCL Engine -> Git Remote` (status + refs)

`CLI/Web/Agent -> SCCL Lease Store -> lock(branch)`

`PatchPack -> SCCL Apply -> conflict report + run record -> Governance APIs/UI`

`SCCL Gate -> CI verify:sccl -> pass/fail with fix steps`

## Integration points

- **Determinism**: SCCL references replay IDs; hashing/replay semantics unchanged.
- **DGL**: SCCL run records store DGL report paths and context hashes.
- **CPX**: CPX arbitration IDs flow through patch-pack metadata.
- **Supervisory**: governance page + API pagination expose coherence health across clients.
