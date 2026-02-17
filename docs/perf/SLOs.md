# Reach Performance & Reliability SLOs

These budgets are the regression gates for idle orchestration responsiveness and mobile stability.

## Local development targets

- Trigger → first SSE event: **p50 ≤ 250ms**, **p95 ≤ 900ms**.
- Approval click → runner resumes: **p50 ≤ 300ms**, **p95 ≤ 1.2s**.
- Event fanout to 3 clients: **p95 ≤ 1.5s** under **10 events/sec** sustained.
- Webhook → trigger enqueue: **p95 ≤ 1.5s**.
- Capsule sync roundtrip: **p95 ≤ 2.0s** for metadata-only payloads.
- Mobile event timeline: smooth virtualized scrolling with **1,000 events retained max** and capped memory buffers.

## Production aspirational targets

(Use these when production telemetry is available and representative.)

- Trigger → first SSE event: **p50 ≤ 180ms**, **p95 ≤ 650ms**.
- Approval click → runner resumes: **p50 ≤ 220ms**, **p95 ≤ 900ms**.
- Event fanout to 3 clients: **p95 ≤ 1.0s** at **10 events/sec**.
- Webhook → trigger enqueue: **p95 ≤ 1.0s**.
- Capsule sync roundtrip metadata-only: **p95 ≤ 1.5s**.

## Reliability guardrails

- Outbound HTTP calls use explicit timeouts.
- Transient trigger dispatch failures use bounded exponential backoff retries.
- Trigger dispatch enters a temporary circuit-open state after repeated failures.
- Event streams apply bounded queues and drop low-priority events before critical events.
- Fallback behavior remains available when dependent services are down.
