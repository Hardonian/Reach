#!/bin/bash
# Checks for broken links to moved spec files
# Usage: ./scripts/maintenance/check-broken-links.sh

set -e

# List of moved files
MOVED_FILES=(
  "EXECUTION_PROTOCOL.md"
  "SPEC_FORMALIZATION_SUMMARY.md"
  "EXECUTION_SPEC.md"
  "GRAPH_EXECUTION_SPEC.md"
  "ADAPTIVE_ENGINE_SPEC.md"
  "MODEL_ROUTING_SPEC.md"
  "FEDERATED_EXECUTION_SPEC.md"
  "TRUST_NEGOTIATION_SPEC.md"
  "EXECUTION_PACK_SPEC.md"
  "AUTOPACK_SPEC.md"
  "CAPABILITY_REGISTRY.md"
  "ARCADE_SPEC.md"
)

echo "🔍 Scanning for broken links to moved specs..."
FOUND_ISSUES=0

# Iterate through each moved file and grep for references
for file in "${MOVED_FILES[@]}"; do
  # Search for the filename in markdown files
  # Exclude docs/specs (where they live now) and common ignore dirs
  if grep -r "$file" . --include="*.md" --exclude-dir="node_modules" --exclude-dir=".git" --exclude-dir="reach-output" --exclude-dir="docs/specs" > /dev/null; then
    echo "⚠️  Potential broken link to $file in:"
    grep -r "$file" . --include="*.md" --exclude-dir="node_modules" --exclude-dir=".git" --exclude-dir="reach-output" --exclude-dir="docs/specs" | sed 's/^/   - /'
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
  fi
done

if [ $FOUND_ISSUES -eq 0 ]; then
  echo "✅ No obvious broken links found (checked for old filenames outside docs/specs)."
else
  echo ""
  echo "❌ Found $FOUND_ISSUES potential broken links."
  echo "   Please update these references to point to the new docs/specs/<category>/ locations."
  exit 1
fi
