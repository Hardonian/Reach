#!/usr/bin/env bash
set -euo pipefail

# Conformance test for {{PACK_NAME}}

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

if ! jq -e '.governed' pack.json >/dev/null; then
    echo "ERROR: governed flag is required for policy packs"
    exit 1
fi

# Test 3: Policy contract exists
echo "  - Checking policy contract..."
if [[ ! -f "policy.rego" ]]; then
    echo "ERROR: policy.rego not found"
    exit 1
fi

# Test 4: Policy has package declaration
echo "  - Validating policy structure..."
if ! grep -q "package reach.policy" policy.rego; then
    echo "ERROR: policy.rego missing package declaration"
    exit 1
fi

# Test 5: Signing is configured
echo "  - Checking signing configuration..."
if ! jq -e '.signing.required' pack.json >/dev/null; then
    echo "ERROR: governed packs must require signing"
    exit 1
fi

echo "All conformance tests passed!"
