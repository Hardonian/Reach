#!/bin/bash
# Verifies that specs are in their correct locations
# Usage: ./scripts/maintenance/verify-structure.sh

set -e

EXPECTED_FILES=(
  "docs/specs/protocol/EXECUTION_PROTOCOL.md"
  "docs/specs/protocol/SPEC_FORMALIZATION_SUMMARY.md"
  "docs/specs/runtime/EXECUTION_SPEC.md"
  "docs/specs/runtime/GRAPH_EXECUTION_SPEC.md"
  "docs/specs/runtime/ADAPTIVE_ENGINE_SPEC.md"
  "docs/specs/runtime/MODEL_ROUTING_SPEC.md"
  "docs/specs/federation/FEDERATED_EXECUTION_SPEC.md"
  "docs/specs/federation/TRUST_NEGOTIATION_SPEC.md"
  "docs/specs/packaging/EXECUTION_PACK_SPEC.md"
  "docs/specs/packaging/AUTOPACK_SPEC.md"
  "docs/specs/packaging/CAPABILITY_REGISTRY.md"
  "docs/specs/ecosystem/ARCADE_SPEC.md"
)

MISSING=0
for file in "${EXPECTED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing: $file"
    MISSING=$((MISSING + 1))
  fi
done

# Check for duplicates in root
ROOT_DUPLICATES=0
for file in "${EXPECTED_FILES[@]}"; do
  filename=$(basename "$file")
  if [ -f "$filename" ]; then
    echo "❌ Duplicate found in root: $filename"
    ROOT_DUPLICATES=$((ROOT_DUPLICATES + 1))
  fi
done

if [ $MISSING -eq 0 ] && [ $ROOT_DUPLICATES -eq 0 ]; then
  echo "✅ All specs are in the correct structure."
else
  echo "❌ Structure verification failed ($MISSING missing, $ROOT_DUPLICATES duplicates)."
  exit 1
fi
