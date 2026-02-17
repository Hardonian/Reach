# Fail Points & Choke Points (Measured)

Source measurements:
- `tools/perf/report-storm.json` (baseline stress profile)
- `tools/perf/report.json` (optimized fast profile)

## Ranked choke points (by p95 latency)

1. **trigger_to_first_event** — highest p95 under spawn/webhook storms.
2. **approval_to_resume** — second highest during approval fan-in bursts.
3. **fanout_latency** — third highest under many concurrent clients.
4. spawn_scheduling_overhead.

## Top 3 fixes implemented

1. **Session fanout bounded queues + micro-batching + critical bypass**
   - Added per-client bounded queues.
   - Added 150ms batching window for normal/passive events.
   - Critical events bypass batching to reduce control-path latency.
2. **Trigger dispatch reliability guardrails**
   - Added retry/backoff for runner dispatch.
   - Added circuit breaker for repeated downstream failures.
   - Added propagation of correlation headers to downstream calls.
3. **Metrics + request correlation logging path**
   - Added Prometheus-style `/metrics` in integration-hub and session-hub.
   - Added counters for replay/verify failures and fanout drop pressure.

## Before/After (p95 ms)

| Metric | Before (storm) | After (fast) | Delta |
|---|---:|---:|---:|
| trigger_to_first_event | 1066.5 | 1058.1 | -8.4 |
| approval_to_resume | 696.6 | 652.8 | -43.8 |
| fanout_latency | 620.4 | 619.0 | -1.4 |

