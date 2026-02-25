# Event-Driven Reconciliation Loop

## Purpose

Continuously reconcile control-plane state (webhooks, scheduler, leases, run records, remote refs) so Reach and ReadyLayer do not drift into split-brain behavior.

## Components

1. **Webhook receiver**
   - Ingests git host events (push/PR/status).
   - Verifies signature and emits normalized reconciliation jobs.
2. **Scheduler worker**
   - Runs bounded periodic sweeps for repos/workspaces with active governance.
   - Produces deterministic task lists sorted by `{tenant, repo, branch}`.
3. **Task executor**
   - Executes idempotent reconciliation tasks with retry and dead-letter support.
4. **Audit/event sink**
   - Persists structured reconciliation outcomes and policy decisions.

## Reconciliation Tasks

- Detect stale branches and surface retirement recommendations.
- Detect missing run records for branches/PRs with governance activity.
- Detect drift between remote branch heads and local governed snapshots.
- Renew expiring SCCL leases for active operations.
- Emit alerts for unresolved high-risk divergence.

## Determinism Contract

- Input worklists must be canonicalized and sorted before execution.
- Each task must include an idempotency key derived from stable identifiers.
- Drift comparisons use canonical refs and stable hash ordering.
- Retries must not mutate ordering semantics or run identifiers.

## Failure Handling and UX Safety

- User-facing APIs return structured errors and correlation IDs (never hard-500 paths).
- Task retries use bounded exponential backoff and dead-letter capture.
- Partial task failures produce degraded-but-valid status payloads.

## Minimal Data Model

- `tenant_id`
- `workspace_id`
- `repo`
- `branch`
- `run_id` (nullable if missing run is the detected issue)
- `lease_id` (when applicable)
- `task_kind`
- `policy_decision`
- `started_at` / `completed_at`

## Observability Requirements

- Queue depth, retry count, stale-task age, and drift-detection latency.
- Alert ratios by tenant/repo to detect configuration anti-patterns.
- Correlation IDs linking webhook event -> reconciliation task -> audit log entry.

