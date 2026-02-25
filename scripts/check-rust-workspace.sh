#!/usr/bin/env bash
set -euo pipefail

manifest="crates/Cargo.toml"
if [[ ! -f "$manifest" ]]; then
  echo "Rust workspace manifest not found: $manifest"
  exit 1
fi

echo "==> cargo clippy --workspace"
cargo clippy --workspace --manifest-path "$manifest" --all-targets

echo "==> cargo test -p engine-core"
cargo test -p engine-core --manifest-path "$manifest"
