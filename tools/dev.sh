#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/7] Validate protocol schemas"
node tools/codegen/validate-protocol.mjs

echo "[2/7] Rust fmt/clippy"
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings

echo "[3/7] Rust tests"
cargo test -p engine-core
cargo test -p engine

echo "[4/7] WASM compile check"
cargo build -p engine-core --target wasm32-unknown-unknown

echo "[5/7] Go vet/test"
(
  cd services/runner
  go vet ./...
  go test ./...
)

echo "[6/7] Runner dev"
echo "Run: (cd services/runner && go run ./cmd/runnerd)"

echo "[7/7] Mobile"
echo "Android: cd apps/mobile/android && ./gradlew :app:assembleDebug"
echo "iOS: open apps/mobile/ios/ReachIOS in Xcode and build ReachShellView host"
