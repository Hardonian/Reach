# Performance SLOs and CI Gate Fast perf gate thresholds:

- `trigger_to_first_event_p95_ms` <= 1200
- `approval_to_resume_p95_ms` <= 900
- `fanout_latency_p95_ms` <= 700
- `spawn_scheduling_overhead_p95_ms` <= 600
- `events_dropped_total` == 0 in fast profile

Run locally:

```bash
go run ./tools/perf --profile fast --out tools/perf/report.json
```

CI gate reads the generated JSON and fails when any threshold is exceeded.

# Reach Performance & Reliability SLOs These budgets are the regression gates for idle orchestration responsiveness and mobile stability.

## Local development targets - Trigger → first SSE event: **p50 ≤ 250ms**, **p95 ≤ 900ms**.

- Approval click → runner resumes: **p50 ≤ 300ms**, **p95 ≤ 1.2s**.
- Event fanout to 3 clients: **p95 ≤ 1.5s** under **10 events/sec** sustained.
- Webhook → trigger enqueue: **p95 ≤ 1.5s**.
- Transcript sync roundtrip: **p95 ≤ 2.0s** for metadata-only payloads.
- Mobile event timeline: smooth virtualized scrolling with **1,000 events retained max** and capped memory buffers.

## Production aspirational targets (Use these when production telemetry is available and representative.)

- Trigger → first SSE event: **p50 ≤ 180ms**, **p95 ≤ 650ms**.
- Approval click → runner resumes: **p50 ≤ 220ms**, **p95 ≤ 900ms**.
- Event fanout to 3 clients: **p95 ≤ 1.0s** at **10 events/sec**.
- Webhook → trigger enqueue: **p95 ≤ 1.0s**.
- Transcript sync roundtrip metadata-only: **p95 ≤ 1.5s**.

## Reliability guardrails - Outbound HTTP calls use explicit timeouts.

- Transient trigger dispatch failures use bounded exponential backoff retries.
- Trigger dispatch enters a temporary circuit-open state after repeated failures.
- Event streams apply bounded queues and drop low-priority events before critical events.
- Fallback behavior remains available when dependent services are down.
