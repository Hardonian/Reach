# Orchestration Architecture ## Durable Queue (runner)
Runner persists orchestration jobs in SQLite-backed tables: `jobs`, `job_attempts`, and `job_results`.

- **Leasing:** workers atomically lease ready jobs using ordered selection (`priority`, `tenant_id`, `session_id`, `created_at`, `id`).
- **Idempotency:** `(tenant_id, idempotency_key)` is unique so duplicate side effects are rejected.
- **Retries:** failures move jobs to `retry_wait` with bounded exponential backoff + deterministic jitter.
- **Dead-letter:** jobs exceeding `max_attempts` transition to `dead_letter`.

## Scheduler Scheduler decisions are deterministic and fair by sorting jobs by:
1. priority lane
2. tenant id
3. session id
4. stable id

Deferral reasons are explicit:
- `session_budget`
- `node_capacity`

## Node-aware Routing Nodes are stored durably in `nodes` with heartbeat state and load indicators:
- `type`: local | hosted | enterprise
- `latency_ms`
- `load_score`
- `status`

Placement is policy constrained by plan tier. Free never escalates silently to hosted/enterprise nodes.
