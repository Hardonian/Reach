#!/usr/bin/env bash
# Mobile Guided Flow Smoke Test
# Tests the complete wizard → verify → share flow

set -euo pipefail

REACH_DIR="${REACH_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
DATA_DIR="$(mktemp -d)"
export REACH_DATA_DIR="$DATA_DIR"
export REACH_MOBILE=1
export REACH_LOW_MEMORY=1
export REACH_OFFLINE_FIRST=1

trap 'rm -rf "$DATA_DIR"' EXIT

echo "=== Reach Mobile Guided Flow Test ==="
echo "Data dir: $DATA_DIR"
echo

# Setup test registry
mkdir -p "$DATA_DIR/registry"
cat > "$DATA_DIR/registry/index.json" << 'EOF'
{
  "packs": [
    {
      "name": "test.echo",
      "spec_version": "1.0",
      "signature": "test",
      "verified": true,
      "description": "Test echo pack"
    }
  ]
}
EOF

cd "$REACH_DIR"

echo "1. Testing wizard (quick mode)..."
WIZARD_OUTPUT=$(cd services/runner && go run ./cmd/reachctl wizard --quick --json 2>/dev/null)
RUN_ID=$(echo "$WIZARD_OUTPUT" | grep -o '"run_id": "[^"]*"' | cut -d'"' -f4)

if [[ -z "$RUN_ID" ]]; then
    echo "FAIL: Wizard did not produce run ID"
    echo "Output: $WIZARD_OUTPUT"
    exit 1
fi
echo "   ✓ Run created: $RUN_ID"

echo
echo "2. Verifying run record exists..."
if [[ ! -f "$DATA_DIR/runs/$RUN_ID.json" ]]; then
    echo "FAIL: Run record not found at $DATA_DIR/runs/$RUN_ID.json"
    exit 1
fi
echo "   ✓ Run record exists"

echo
echo "3. Testing proof verification..."
PROOF_OUTPUT=$(cd services/runner && go run ./cmd/reachctl proof verify "$RUN_ID" 2>/dev/null)
if ! echo "$PROOF_OUTPUT" | grep -q "deterministic.*true"; then
    echo "FAIL: Proof verification did not confirm determinism"
    echo "Output: $PROOF_OUTPUT"
    exit 1
fi
echo "   ✓ Proof verified"

echo
echo "4. Testing capsule creation..."
CAPSULE_OUTPUT=$(cd services/runner && go run ./cmd/reachctl capsule create "$RUN_ID" 2>/dev/null)
if ! echo "$CAPSULE_OUTPUT" | grep -q '"capsule"'; then
    echo "FAIL: Capsule creation failed"
    echo "Output: $CAPSULE_OUTPUT"
    exit 1
fi
echo "   ✓ Capsule created"

echo
echo "5. Testing capsule verification..."
CAPSULE_FILE="$DATA_DIR/capsules/$RUN_ID.capsule.json"
if [[ ! -f "$CAPSULE_FILE" ]]; then
    echo "FAIL: Capsule file not found at $CAPSULE_FILE"
    exit 1
fi

VERIFY_OUTPUT=$(cd services/runner && go run ./cmd/reachctl capsule verify "$CAPSULE_FILE" 2>/dev/null)
if ! echo "$VERIFY_OUTPUT" | grep -q '"verified": true'; then
    echo "FAIL: Capsule verification failed"
    echo "Output: $VERIFY_OUTPUT"
    exit 1
fi
echo "   ✓ Capsule verified"

echo
echo "6. Testing share command..."
SHARE_OUTPUT=$(cd services/runner && go run ./cmd/reachctl share run "$RUN_ID" 2>/dev/null)
if ! echo "$SHARE_OUTPUT" | grep -q "reach://share/$RUN_ID"; then
    echo "FAIL: Share URL not generated correctly"
    echo "Output: $SHARE_OUTPUT"
    exit 1
fi
echo "   ✓ Share URL generated"

echo
echo "7. Testing operator dashboard..."
OPERATOR_OUTPUT=$(cd services/runner && go run ./cmd/reachctl operator 2>/dev/null)
if ! echo "$OPERATOR_OUTPUT" | grep -q '"runs"'; then
    echo "FAIL: Operator dashboard missing runs data"
    echo "Output: $OPERATOR_OUTPUT"
    exit 1
fi
echo "   ✓ Operator dashboard accessible"

echo
echo "8. Testing mobile doctor..."
cd tools/doctor
DOCTOR_OUTPUT=$(REACH_MOBILE=1 go run . --json 2>/dev/null)
if ! echo "$DOCTOR_OUTPUT" | grep -q '"overall"'; then
    echo "FAIL: Mobile doctor did not produce valid output"
    echo "Output: $DOCTOR_OUTPUT"
    exit 1
fi
echo "   ✓ Mobile doctor working"

echo
echo "=== All Mobile Guided Flow Tests Passed ==="
echo
echo "Summary:"
echo "  • Wizard creates runs correctly"
echo "  • Run records are persisted"
echo "  • Proof verification works"
echo "  • Capsule creation/verification works"
echo "  • Share command generates valid URLs"
echo "  • Operator dashboard shows metrics"
echo "  • Mobile doctor reports health"
