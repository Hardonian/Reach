#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[e2e-smoke] marketplace install-intent/install/uninstall flow"
(
  cd services/connector-registry
  go test ./internal/registry -run 'MarketplaceIdempotencyFlow|InstallIntentAndConsentEnforcement|TierAndNoAutoUpgrade|InstallAndUninstall' -count=1
)

echo "[e2e-smoke] policy deny negative test"
cargo test -p engine-core policy_denies -- --nocapture
