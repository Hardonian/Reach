# Event-Driven Reconciliation Loop

## Loop Design
- **Ingress:** git webhook receiver (`/api/github/webhook`).
- **Scheduler:** periodic reconciliation sweep (every N minutes).
- **Tasks:**
  - stale branch detection
  - missing run-record detection
  - remote drift detection
  - lease renewal for active SCCL operations
  - alert emission into audit/event streams

## Deterministic Contract
- Reconciliation worklists must be sorted deterministically by `{tenant, repo, branch}`.
- Drift comparisons must use canonicalized refs and stable hash ordering.

## Failure Handling
- Never hard-500 user routes; return structured errors with correlation ID.
- Reconciliation retries use bounded exponential backoff with dead-letter logging.
