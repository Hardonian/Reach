#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/4] doctor"
./reach doctor

echo "[2/4] unit tests"
(
  cd internal/packkit
  go test ./...
)
(
  cd services/connector-registry
  go test ./...
)
(
  cd services/runner
  go test ./internal/jobs ./internal/mcpserver ./internal/workspace
)
cargo test -p engine-core

echo "[3/4] e2e smoke"
./tools/e2e-smoke.sh

echo "[4/4] static checks"
node tools/codegen/validate-protocol.mjs
(
  cd internal/packkit
  go test ./registry -run 'Golden|Parse|MultiRegistry|Stable' -count=1
)

echo "release-check passed"
