# Contributing to Reach

Thanks for contributing to Reach.

## Prerequisites

- Go 1.22.x
- Rust stable (pinned by `rust-toolchain.toml`)
- Node.js 18+
- JDK 17+ (Android)

## Verify your environment

From repo root:

```bash
make doctor
```

`reach doctor` checks required tooling and runs quick repo health checks.

## Build release artifacts locally

```bash
make release-artifacts
```

The script cross-compiles Go service binaries and writes checksums to `dist/SHA256SUMS`.

## Run core checks manually

```bash
node tools/codegen/validate-protocol.mjs
cd services/runner && go test ./...
cargo test -p engine-core
```

## Release process

1. Update `VERSION`.
2. Add changelog entry in `CHANGELOG.md`.
3. Ensure `make doctor` passes.
4. Tag release: `git tag v$(cat VERSION)`.
5. Push tag to trigger `.github/workflows/release.yml`.

## Code style expectations

- Keep `crates/engine` deterministic and side-effect free.
- Keep transport/runtime concerns in runner, FFI, or app layers.
- Update protocol schemas when wire contracts change.
- Prefer small, focused pull requests.
- Ensure CI passes before requesting review.


### iOS shell
A minimal SwiftUI shell lives in `apps/mobile/ios/ReachIOS` and can be compiled in Xcode for SSE terminal streaming.


## Run all Go services checks

From repo root:

```bash
for d in services/*; do
  if [ -f "$d/go.mod" ]; then
    (cd "$d" && go vet ./... && go test ./...)
  fi
done
```

## VS Code extension checks

```bash
cd extensions/vscode
npm install
npm run build
npm run lint
```

## iOS compile check

```bash
cd apps/mobile/ios/ReachIOS
xcodebuild -list
```
