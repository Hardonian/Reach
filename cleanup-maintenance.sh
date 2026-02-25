#!/bin/bash
# Removes the one-time maintenance scripts and associated hooks.

set -e

echo "Cleaning up maintenance scripts and hooks..."

# List of items to remove
ITEMS_TO_REMOVE=(
  "scripts/maintenance/audit-hygiene.sh"
  "scripts/maintenance/check-broken-links.sh"
  "scripts/maintenance/fix-broken-links.sh"
  "scripts/maintenance/fix-markdown-hygiene.sh"
  "scripts/maintenance/generate-audit-report.sh"
  "scripts/maintenance/restructure-specs.sh"
  "scripts/maintenance/run-all.sh"
  "scripts/maintenance/verify-structure.sh"
  ".husky/pre-commit"
)

for item in "${ITEMS_TO_REMOVE[@]}"; do
  if [ -f "$item" ]; then
    git rm "$item"
    echo "Removed $item"
  else
    echo "Skipped $item (not found)"
  fi
done

# Remove the maintenance script from package.json
sed -i '/"maintenance":/d' package.json
git add package.json

echo "✅ Maintenance script cleanup complete."
