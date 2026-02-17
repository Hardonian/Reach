# Performance SLOs and CI Gate

Fast perf gate thresholds:

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
