# Reach

Reach is an OSS stack for running deterministic agent workflows across a **mobile cockpit**, a **Go runner**, a **Rust engine**, and **MCP-compatible tools**.

## Versioning

Reach uses a single source of truth for release versioning:

- `VERSION` at repo root (SemVer)
- `CHANGELOG.md` in Keep a Changelog format
- Build pipelines inject this version into service binaries (`main.version`) and expose it via `/version` and `/healthz`

## Architecture

- `apps/mobile/android` — Android cockpit app
- `apps/mobile/ios/ReachIOS` — iOS Swift package shell
- `services/*` — Go services (runner, integration-hub, session-hub, ide-bridge, connector-registry, capsule-sync)
- `crates/engine*` — Rust deterministic engine and core crates
- `extensions/vscode` — VS Code extension
- `protocol/schemas` — JSON Schemas for wire protocol

## Developer checks

Run full local health checks:

```bash
./reach doctor
```

This runs:

- toolchain presence checks (Go, Rust, Cargo, Node)
- protocol schema validation
- `go test ./...` in `services/runner`
- `cargo test -p engine-core`

## Build release artifacts

```bash
make release-artifacts
```

Artifacts are written to `dist/` with SHA256 integrity metadata in `dist/SHA256SUMS`.

## CI and release

- `.github/workflows/ci.yml` runs fast PR checks (protocol, Rust, Go, VS Code)
- `.github/workflows/release.yml` triggers on `v*` tags and publishes all built binaries + checksums

## Toolchain pinning

- Rust pinned via `rust-toolchain.toml`
- Go pinned in CI workflows to `1.22.7`
