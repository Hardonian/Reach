#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 '<cargo args>'" >&2
  exit 2
fi

CARGO_ARGS=("$@")
VENDOR_DIR="third_party/rust/vendor"

if [[ -d "$VENDOR_DIR" ]] && [[ -n "$(find "$VENDOR_DIR" -mindepth 1 -maxdepth 1 2>/dev/null)" ]]; then
  echo "Using vendored Rust dependencies from $VENDOR_DIR"
  CARGO_HOME="${CARGO_HOME:-$PWD/.cargo-home-offline}" \
  CARGO_NET_OFFLINE=true \
  cargo --config .cargo/config.vendored.toml "${CARGO_ARGS[@]}"
  exit 0
fi

echo "Vendored dependencies not found; using networked cargo mode"
cargo "${CARGO_ARGS[@]}"
