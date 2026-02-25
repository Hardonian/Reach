#!/bin/bash
# Fixes broken markdown links after spec file restructuring.
# Usage: ./scripts/maintenance/fix-broken-links.sh

set -e

echo "Fixing broken links to moved spec files..."

# Find all markdown files, excluding the new spec directory and other common ignores
FILES=$(find . -name "*.md" -not -path "./docs/specs/*" -not -path "./node_modules/*" -not -path "./.git/*")

if [ -z "$FILES" ]; then
  echo "No markdown files found to check."
  exit 0
fi

# Protocol
echo "$FILES" | xargs sed -i 's|([./]*EXECUTION_PROTOCOL.md)|(docs/specs/protocol/EXECUTION_PROTOCOL.md)|g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's|([./]*SPEC_FORMALIZATION_SUMMARY.md)|(docs/specs/protocol/SPEC_FORMALIZATION_SUMMARY.md)|g' 2>/dev/null || true

# Runtime
echo "$FILES" | xargs sed -i 's|([./]*EXECUTION_SPEC.md)|(docs/specs/runtime/EXECUTION_SPEC.md)|g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's|([./]*GRAPH_EXECUTION_SPEC.md)|(docs/specs/runtime/GRAPH_EXECUTION_SPEC.md)|g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's|([./]*ADAPTIVE_ENGINE_SPEC.md)|(docs/specs/runtime/ADAPTIVE_ENGINE_SPEC.md)|g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's|([./]*MODEL_ROUTING_SPEC.md)|(docs/specs/runtime/MODEL_ROUTING_SPEC.md)|g' 2>/dev/null || true

# Federation
echo "$FILES" | xargs sed -i 's|([./]*FEDERATED_EXECUTION_SPEC.md)|(docs/specs/federation/FEDERATED_EXECUTION_SPEC.md)|g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's|([./]*TRUST_NEGOTIATION_SPEC.md)|(docs/specs/federation/TRUST_NEGOTIATION_SPEC.md)|g' 2>/dev/null || true

# Packaging
echo "$FILES" | xargs sed -i 's|([./]*EXECUTION_PACK_SPEC.md)|(docs/specs/packaging/EXECUTION_PACK_SPEC.md)|g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's|([./]*AUTOPACK_SPEC.md)|(docs/specs/packaging/AUTOPACK_SPEC.md)|g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's|([./]*CAPABILITY_REGISTRY.md)|(docs/specs/packaging/CAPABILITY_REGISTRY.md)|g' 2>/dev/null || true

# Ecosystem
echo "$FILES" | xargs sed -i 's|([./]*ARCADE_SPEC.md)|(docs/specs/ecosystem/ARCADE_SPEC.md)|g' 2>/dev/null || true

echo "✅ Link fixing complete. Please review the changes."
