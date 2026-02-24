#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${REACH_BIN_DIR:-$HOME/.reach/bin}"
mkdir -p "$BIN_DIR"

pushd "$ROOT_DIR/services/runner" >/dev/null
go build -o "$BIN_DIR/reachctl" ./cmd/reachctl
popd >/dev/null

cat <<MSG
Installed reachctl to: $BIN_DIR/reachctl
Add this to PATH if needed:
  export PATH="$BIN_DIR:\$PATH"
Verify:
  reachctl doctor
MSG
