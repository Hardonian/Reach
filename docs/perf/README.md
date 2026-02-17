# Performance Harness

## Local runner metrics check

1. Start runner with metrics:

```bash
cd services/runner
RUNNER_METRICS_ENABLED=1 RUNNER_ADDR=:8080 go run ./cmd/runnerd
```

2. In another shell, seed a few requests and run the gate:

```bash
curl -sS -X POST http://localhost:8080/auth/dev-login -c /tmp/reach.cookies
curl -sS -X POST http://localhost:8080/v1/runs -b /tmp/reach.cookies -H 'Content-Type: application/json' -d '{"capabilities":["read"],"scope":["workspace"],"plan_tier":"pro"}'
curl -sS -X POST http://localhost:8080/internal/v1/triggers -H 'Content-Type: application/json' -d '{"tenant_id":"perf-local","source":"github","type":"webhook","payload":{"event":"push"}}'
cd tools/perf && go run . -metrics-url http://localhost:8080/metrics
```

Expected output shape:

```text
trigger_p95=0.120000s approval_p95=0.000000s request_max_p95=0.200000s
PASS: perf thresholds within budget
```
