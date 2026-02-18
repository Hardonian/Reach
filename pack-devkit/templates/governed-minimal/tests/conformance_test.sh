#!/usr/bin/env bash
set -euo pipefail

# Conformance test for {{PACK_NAME}}
# This test verifies the pack meets Reach protocol standards

echo "Running conformance tests for {{PACK_NAME}}..."

# Test 1: Pack JSON is valid
echo "  - Validating pack.json..."
if ! jq empty pack.json 2>/dev/null; then
    echo "ERROR: pack.json is not valid JSON"
    exit 1
fi

# Test 2: Required fields present
echo "  - Checking required fields..."
if ! jq -e '.spec_version' pack.json >/dev/null; then
    echo "ERROR: spec_version is required"
    exit 1
fi

if ! jq -e '.metadata.id' pack.json >/dev/null; then
    echo "ERROR: metadata.id is required"
    exit 1
fi

if ! jq -e '.deterministic' pack.json >/dev/null; then
    echo "ERROR: deterministic flag is required"
    exit 1
fi

# Test 3: Determinism is enabled
echo "  - Checking determinism..."
if [[ "$(jq -r '.deterministic' pack.json)" != "true" ]]; then
    echo "ERROR: Pack must be deterministic"
    exit 1
fi

echo "All conformance tests passed!"
