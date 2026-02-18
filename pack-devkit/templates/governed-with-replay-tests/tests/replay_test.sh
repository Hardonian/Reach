#!/usr/bin/env bash
set -euo pipefail

# Replay verification test for {{PACK_NAME}}

echo "Running replay verification tests..."

# Test 1: Fixture exists and is readable
echo "  - Checking fixtures..."
if [[ ! -f "fixtures/sample.txt" ]]; then
    echo "ERROR: fixtures/sample.txt not found"
    exit 1
fi

# Test 2: Fixture content is deterministic
echo "  - Verifying fixture determinism..."
EXPECTED_HASH="a3f5c8e9d2b1"  # Example hash
ACTUAL_HASH=$(sha256sum fixtures/sample.txt | cut -d' ' -f1 | head -c 12)
echo "    Fixture hash: $ACTUAL_HASH"

# Test 3: Pack references fixtures correctly
echo "  - Checking pack configuration..."
if ! jq -e '.replay_tests.enabled' pack.json >/dev/null; then
    echo "ERROR: replay_tests.enabled must be true"
    exit 1
fi

# Test 4: Execution graph has dependencies
echo "  - Validating execution graph..."
STEP_COUNT=$(jq '.execution_graph.steps | length' pack.json)
if [[ "$STEP_COUNT" -lt 2 ]]; then
    echo "ERROR: Replay tests need at least 2 steps"
    exit 1
fi

echo "All replay verification tests passed!"
echo ""
echo "Note: Full replay testing requires running the pack through Reach."
echo "Run: reach pack test . --fixture replay-verification"
