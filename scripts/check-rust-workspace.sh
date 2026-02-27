#!/usr/bin/env bash
set -euo pipefail

# Rust Workspace CI Check
# Builds all crates and runs tests with strict warnings

manifest="crates/Cargo.toml"
if [[ ! -f "$manifest" ]]; then
  echo "Rust workspace manifest not found: $manifest"
  exit 1
fi

echo "=========================================="
echo "Rust Engine CI Build"
echo "=========================================="
echo ""
echo "NOTE: The Rust engine is deprecated but maintained"
echo "for backward compatibility. New development should"
echo "use the TypeScript/Requiem protocol stack."
echo ""

# Check if cargo is available
if ! command -v cargo &> /dev/null; then
    echo "Warning: Cargo not found. Skipping Rust build."
    echo "Install Rust from https://rustup.rs/ to build the engine."
    exit 0
fi

echo "==> cargo check --workspace"
RUSTFLAGS="-D warnings" cargo check --workspace --manifest-path "$manifest" --all-targets

echo ""
echo "==> cargo clippy --workspace"
RUSTFLAGS="-D warnings" cargo clippy --workspace --manifest-path "$manifest" --all-targets -- -D warnings

echo ""
echo "==> cargo test -p requiem"
cargo test -p requiem --manifest-path "$manifest"

echo ""
echo "==> cargo test -p engine-core"
cargo test -p engine-core --manifest-path "$manifest"

echo ""
echo "==> cargo build --release -p requiem"
cargo build --release -p requiem --manifest-path "$manifest"

echo ""
echo "=========================================="
echo "Rust Engine CI: PASSED"
echo "=========================================="
