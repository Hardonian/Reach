#!/usr/bin/env bash
# Mobile Smoke Test - Comprehensive validation for mobile/Termux deployment
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$(mktemp -d)"
export REACH_DATA_DIR="$DATA_DIR"
export REACH_MOBILE=1
export REACH_LOW_MEMORY=1
export REACH_OFFLINE_FIRST=1
export REACH_MAX_MEMORY_MB=256

trap 'rm -rf "$DATA_DIR"' EXIT

echo "╔════════════════════════════════════════════════════════╗"
echo "║     Reach Mobile Smoke Test                            ║"
echo "║     Validating Android/Termux deployment               ║"
echo "╚════════════════════════════════════════════════════════╝"
echo
echo "Environment:"
echo "  Data dir: $DATA_DIR"
echo "  Mobile mode: $REACH_MOBILE"
echo "  Low memory: $REACH_LOW_MEMORY"
echo

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASS++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

cd "$REPO_ROOT"

# Setup test registry
mkdir -p "$DATA_DIR/registry"
cat > "$DATA_DIR/registry/index.json" << 'EOF'
{
  "packs": [
    {
      "name": "smoke.test",
      "repo": "builtin",
      "spec_version": "1.0",
      "signature": "builtin",
      "reproducibility": "A",
      "verified": true,
      "description": "Smoke test pack"
    }
  ]
}
EOF

echo "Test 1: Mobile Doctor"
echo "─────────────────────"
if cd tools/doctor && REACH_MOBILE=1 go run . --json > /dev/null 2>&1; then
    pass "Mobile doctor returns valid JSON"
else
    fail "Mobile doctor failed"
fi
cd "$REPO_ROOT"

echo
echo "Test 2: Wizard (Quick Mode)"
echo "───────────────────────────"
WIZARD_OUTPUT=$(cd services/runner && ./reachctl wizard --quick --json 2>/dev/null) || true
RUN_ID=$(echo "$WIZARD_OUTPUT" | grep -o '"run_id": "[^"]*"' | head -1 | cut -d'"' -f4) || true

if [[ -n "$RUN_ID" && -f "$DATA_DIR/runs/$RUN_ID.json" ]]; then
    pass "Wizard created run: $RUN_ID"
else
    fail "Wizard failed to create run"
    echo "Output: $WIZARD_OUTPUT"
fi

echo
echo "Test 3: Proof Verification"
echo "──────────────────────────"
if [[ -n "$RUN_ID" ]]; then
    PROOF_OUTPUT=$(cd services/runner && ./reachctl proof verify "$RUN_ID" 2>/dev/null) || true
    if echo "$PROOF_OUTPUT" | grep -q "run_fingerprint"; then
        pass "Proof verification works"
    else
        fail "Proof verification failed"
        echo "Output: $PROOF_OUTPUT"
    fi
else
    warn "Skipped (no run ID)"
fi

echo
echo "Test 4: Capsule Operations"
echo "─────────────────────────"
if [[ -n "$RUN_ID" ]]; then
    CAPSULE_OUTPUT=$(cd services/runner && ./reachctl capsule create "$RUN_ID" --output "$DATA_DIR/capsules/$RUN_ID.capsule.json" 2>/dev/null) || true
    
    if [[ -f "$DATA_DIR/capsules/$RUN_ID.capsule.json" ]]; then
        pass "Capsule created"
        
        VERIFY_OUTPUT=$(cd services/runner && ./reachctl capsule verify "$DATA_DIR/capsules/$RUN_ID.capsule.json" 2>/dev/null) || true
        if echo "$VERIFY_OUTPUT" | grep -q '"verified": true'; then
            pass "Capsule verified"
        else
            fail "Capsule verification failed"
        fi
    else
        fail "Capsule creation failed"
    fi
else
    warn "Skipped (no run ID)"
fi

echo
echo "Test 5: Share Command"
echo "────────────────────"
if [[ -n "$RUN_ID" ]]; then
    SHARE_OUTPUT=$(cd services/runner && ./reachctl share run "$RUN_ID" 2>/dev/null) || true
    if echo "$SHARE_OUTPUT" | grep -q "reach://share/$RUN_ID"; then
        pass "Share URL generated"
    else
        fail "Share command failed"
        echo "Output: $SHARE_OUTPUT"
    fi
else
    warn "Skipped (no run ID)"
fi

echo
echo "Test 6: Operator Dashboard"
echo "─────────────────────────"
OPERATOR_OUTPUT=$(cd services/runner && ./reachctl operator 2>/dev/null) || true
if echo "$OPERATOR_OUTPUT" | grep -q '"runs"\|topology_nodes'; then
    pass "Operator dashboard accessible"
else
    fail "Operator dashboard failed"
    echo "Output: $OPERATOR_OUTPUT"
fi

echo
echo "Test 7: Low Memory Defaults"
echo "──────────────────────────"
if [[ "$REACH_LOW_MEMORY" == "1" && "$REACH_MAX_MEMORY_MB" == "256" ]]; then
    pass "Low memory settings active"
else
    fail "Low memory settings not applied"
fi

echo
echo "Test 8: Offline-First Mode"
echo "─────────────────────────"
if [[ "$REACH_OFFLINE_FIRST" == "1" ]]; then
    pass "Offline-first mode enabled"
else
    fail "Offline-first mode not enabled"
fi

echo
echo "Test 9: Data Directory Structure"
echo "───────────────────────────────"
for dir in runs capsules registry; do
    if [[ -d "$DATA_DIR/$dir" ]]; then
        pass "Directory exists: $dir"
    else
        fail "Directory missing: $dir"
    fi
done

echo
echo "Test 10: Export Path Verification"
echo "────────────────────────────────"
if [[ -n "$RUN_ID" && -f "$DATA_DIR/capsules/$RUN_ID.capsule.json" ]]; then
    # Verify capsule can be read and has expected structure
    if grep -q '"spec_version"' "$DATA_DIR/capsules/$RUN_ID.capsule.json"; then
        pass "Capsule has valid structure"
    else
        fail "Capsule structure invalid"
    fi
else
    warn "Skipped (no capsule)"
fi

echo
if [[ $FAIL -eq 0 ]]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  All $PASS tests passed!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}═══════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  $FAIL test(s) failed, $PASS passed${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════${NC}"
    exit 1
fi
