# Orchestration Runbook

## Diagnose stuck queues
1. Query `jobs` where `status in ('queued','retry_wait','leased')`.
2. Check expired leases (`leased_until < now`) and re-lease.
3. Inspect `job_attempts` for repeated failure signatures.

## Dead-letter handling
1. Review `jobs.status='dead_letter'` and `last_error`.
2. Patch policy/capability/tier misconfiguration.
3. Re-enqueue with a new idempotency key after corrective action.

## Node offline behavior
1. Heartbeat endpoint updates `last_heartbeat_at` and `status`.
2. Route only to safe allowed node types for the current plan tier.
3. If no safe node exists, defer job instead of privilege escalation.

## Tier errors
Restricted orchestration actions return:
- `error = tier_required`
- `tier_required = <required tier>`
- `next_step` with factual upgrade guidance
