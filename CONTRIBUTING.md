# Contributing to Reach

Thanks for contributing to Reach.

## Prerequisites

- Rust stable toolchain
- Go 1.22+
- Node.js 18+
- JDK 17+ (for Android)

## One command for local verification

From repo root:

```bash
./tools/dev.sh
```

This runs protocol validation plus the core Rust and Go test suites.

## Run Rust tests

From repo root:

```bash
cargo test -p engine
```

Recommended additional checks:

```bash
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
```

## Run Go runner

From repo root:

```bash
cd services/runner
go run ./cmd/runnerd
```

Run runner tests:

```bash
cd services/runner
go test ./...
```

## Run Android app

From repo root:

```bash
cd apps/mobile/android
./gradlew assembleDebug
./gradlew installDebug
```

If you have an emulator/device attached, you can start the installed app from Android Studio or the launcher on the device.

## Code style expectations

- Keep `crates/engine` deterministic and side-effect free.
- Keep transport/runtime concerns in runner, FFI, or app layers.
- Update protocol schemas when wire contracts change.
- Prefer small, focused pull requests.
- Ensure CI passes before requesting review.


### iOS shell
A minimal SwiftUI shell lives in `apps/mobile/ios/ReachIOS` and can be compiled in Xcode for SSE terminal streaming.
