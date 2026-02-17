#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"
echo "[1/3] Validating protocol schemas"
node tools/codegen/validate-protocol.mjs

echo "[2/3] Running Rust engine tests"
cargo test -p engine

echo "[3/3] Running Go runner tests"
(
  cd services/runner
  go test ./...
)

echo "All checks passed."
