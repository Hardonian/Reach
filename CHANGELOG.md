# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-02-20

### Added

- **Docs Drift Guard**: Automated system to ensure docs, env vars, and CLI commands stay in sync (`npm run docs:doctor`).
- **Support & Legal Centers**: Production-grade `/support`, `/legal`, and `/security` routes in the Reach Arcade.
- **Admin Sweep**: Standardized `.github` templates, `CONTRIBUTING.md`, and `GOVERNANCE.md`.
- **System Quality Gate**: Unified `validate` and `verify:full` scripts with security auditing.
- **Navigation Source of Truth**: Unified docs sidebar and navigation configuration.

### Fixed

- Resolved stale environment variables in `.env.example`.
- Fixed broken links and markdown hygiene issues repository-wide.
- Corrected Tailwind CSS v4 syntax warnings in Arcade components.
- Eliminated legacy inline styles in favor of design system primitives.

## [0.2.1] - 2026-02-18

### Fixed

- Fixed protocol schema validation by correcting malformed `toolcall.schema.json`.
- Repaired runner Go compilation/test regressions in autonomous API tests and jobs store logic.
- Switched UniFFI crate to Rust macro scaffolding setup to unblock workspace lint/test runs.
- Added repository-level `.env.example` and `SECURITY.md` contributor/security hygiene docs.

## [0.2.0] - 2026-02-17

### Added

- Repository-wide `VERSION` source of truth and release build scripts under `tools/release`.
- Cross-platform `reach doctor` tool under `tools/doctor` with dependency and repo health checks.
- Release workflow that builds multi-platform Go artifacts and publishes SHA256 checksums.
- Service `/healthz` and `/version` endpoints that expose build version metadata.
- Rust toolchain pinning via `rust-toolchain.toml`.
- Added runner multi-tenant auth sessions with GitHub OAuth endpoints and dev fallback.
- Added SQLite-backed persistent storage with startup migrations and resumable SSE events.
- Added plugin manifest signing/verification pipeline and trusted key registry support.
- Added structured runner metrics counters and log redaction for sensitive tool output.
- Added release skeleton workflow and protocol plugin manifest schema.

### Changed

- CI workflows now pin Go 1.22.7 and add dependency caches for Go/Rust/Node where applicable.
- VS Code extension and Android app version metadata now track repository release version `0.2.0`.

[0.3.0]: https://github.com/reach/reach/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/reach/reach/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/reach/reach/releases/tag/v0.2.0
