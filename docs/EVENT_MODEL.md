# Event Model Reach uses a single internal event stream as the source of truth for replay, proofs, graph exports, explain output, arena scoring, operator telemetry, and gamification hooks.

## Canonical stream contract - Events are JSON payloads validated by event type before storage.

- Each event payload carries `schemaVersion` (defaulted to `1.0.0` if omitted).
- Unknown schema versions are rejected for deterministic compatibility.
- Required fields are enforced per event type (`spawn.event`, `guardrail.stop`, `session.started`, `capsule.sync`, and policy gate events).

Implementation reference: `services/runner/internal/jobs/event_schema.go`.

## Deterministic ordering and serialization - Event logs are persisted and consumed as ordered arrays.

- Deterministic fingerprints are computed from stable JSON encoding over `run_id` + `event_log`.
- Capsule verify/replay and proof verification recompute this same fingerprint.

Implementation references:

- `services/runner/cmd/reachctl/main.go` (`stableHash`, capsule/proof commands)
- `docs/EXECUTION_MODEL.md`

## Redaction and secret safety - Support and explain surfaces are constrained to safe/templated responses.

- Bot input is redacted for token-like strings before retrieval.
- Event payload validation requires structured JSON objects and rejects malformed payloads.

Implementation references:

- `services/runner/internal/support/bot.go`
- `services/runner/internal/jobs/event_schema.go`

## Compatibility policy - Payload normalizer preserves compatibility by defaulting missing `schemaVersion` to `1.0.0`.

- Explicit mismatched versions are rejected instead of silently coercing, preventing replay drift.

## Event hooks used by product features The following hooks are consumed by the gamification store and scoreboards:

- `onRunCompleted`
- `onRunFailed`
- `onPolicyDenied`
- `onReplayVerified`
- `onDelegationSuccess`
- `onDelegationFailure`

Implementation reference: `services/runner/internal/arcade/gamification`.
