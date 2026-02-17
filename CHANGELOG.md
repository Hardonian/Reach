# Changelog

## 0.2.1
- Fixed protocol schema validation by correcting malformed `toolcall.schema.json`.
- Repaired runner Go compilation/test regressions in autonomous API tests and jobs store logic.
- Switched UniFFI crate to Rust macro scaffolding setup to unblock workspace lint/test runs.
- Added repository-level `.env.example` and `SECURITY.md` contributor/security hygiene docs.

## 0.2.0
- Added runner multi-tenant auth sessions with GitHub OAuth endpoints and dev fallback.
- Added SQLite-backed persistent storage with startup migrations and resumable SSE events.
- Added plugin manifest signing/verification pipeline and trusted key registry support.
- Added structured runner metrics counters and log redaction for sensitive tool output.
- Added release skeleton workflow and protocol plugin manifest schema.
