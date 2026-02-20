# Unified Correlation Model All edge-to-agent traffic carries the following fields in request headers, event envelopes, and structured logs:

- `trace_id`: distributed trace identifier (preferred from `traceparent` or `X-Trace-ID`).
- `session_id`: collaboration/session channel identity.
- `run_id`: workflow run identity.
- `agent_id`: logical agent identity.
- `spawn_id`: spawn operation identity.
- `node_id`: assigned execution node identity.
- `request_id`: per-request ID for log stitching.

## Header mapping | Field | Header |
|---|---|
| trace_id | `traceparent` (trace-id segment) or `X-Trace-ID` |
| session_id | `X-Session-ID` |
| run_id | `X-Run-ID` |
| agent_id | `X-Agent-ID` |
| spawn_id | `X-Spawn-ID` |
| node_id | `X-Node-ID` |
| request_id | `X-Request-ID` |

## Transport map (baseline) - `runner`: HTTP JSON APIs and event polling (`GET /v1/runs/{id}/events`).
- `session-hub`: WebSocket session fanout (`GET /ws/session/{session_id}`).
- `integration-hub`: HTTP APIs and inbound webhooks (`/webhooks/*`).
- `capsule-sync`: HTTP APIs.
- `ide-bridge`: HTTP APIs + WebSocket editor channel (`/v1/ws/{editor_id}`).

## Critical flow checkpoints 1. trigger -> first event
2. approval -> resume
3. spawn -> child run start
4. fanout -> clients receive
5. webhook -> trigger enqueue

Each checkpoint should log correlation fields and emit latency metrics.
