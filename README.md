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

For a canonical pre-push Go sweep across all Go modules, run:

```bash
make go-module-sanity
```

This runs:

- toolchain presence checks (Go, Rust, Cargo, Node)
- protocol schema validation
- `go test ./...` in `services/runner`
- `cargo test -p engine-core`

## Repo-wide verification commands

From repo root:

```bash
npm install
(cd extensions/vscode && npm install)
npm run verify:fast
npm run verify:full
```

Script breakdown:

- `npm run lint` → protocol validation, Rust fmt/clippy, Go vet (runner), VS Code extension lint
- `npm run typecheck` → Rust workspace check, VS Code extension TypeScript compile
- `npm run test` → Rust engine-core tests, Go runner tests, VS Code extension tests
- `npm run build` → Rust workspace build, Go runner build, VS Code extension build

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


## Mobile Build

### iOS (Swift SDK)

```bash
cd mobile/ios/ReachSDK
swift build
swift test
```

Optional demo harness directory: `mobile/ios/ReachArcadeDemo`.

### Android (Kotlin SDK + demo)

```bash
cd mobile/android
gradle :reach-sdk:test :ReachArcadeDemo:assembleDebug
```

### Mobile smoke against local runner

```bash
# in one terminal
cd services/runner && go run ./cmd/runnerd

# in another terminal
REACH_BASE_URL=http://localhost:8080 ./tools/mobile-smoke.sh
```
