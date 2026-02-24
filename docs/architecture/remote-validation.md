# Remote Validation (Optional OSS)

Service binary: `reach-remote-validate`.

Endpoints:
- `GET /health`
- `GET /public-key`
- `POST /validate`

Client command:
- `reach validate remote --url <base-url> --capsule <file>`

Response includes deterministic fields and Ed25519 signature.

This feature is optional; local verify/replay remains authoritative for OSS workflows.
