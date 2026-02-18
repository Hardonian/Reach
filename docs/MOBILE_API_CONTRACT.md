# Reach Mobile API Contract

Source of truth for mobile clients is `contracts/mobile.yaml`.

## Security and invariants

- Mobile clients must authenticate with `reach_session` cookie (dev login for local/dev).
- Handshake is challenge/response with Ed25519 public key and signature.
- Policy preflight never bypasses policy gate; it only reports whether the requested capability set is admissible.
- Timeline and shared timeline endpoints are redacted by default.
- Redaction rules:
  - Any payload field containing case-insensitive `secret`, `token`, `key`, or `password` is replaced with `[REDACTED]`.
  - Shared timeline endpoint is always redacted and unauthenticated access is token-scoped only.

## Endpoint map

- `POST /v1/mobile/handshake/challenge`
- `POST /v1/mobile/handshake/complete`
- `POST /v1/mobile/policy/preflight`
- `POST /v1/runs`
- `GET /v1/mobile/runs/{id}`
- `POST /v1/mobile/share-tokens`
- `GET /v1/mobile/share/{token}`

These endpoints intentionally do not expose raw secrets, keys, or unredacted tool output.
