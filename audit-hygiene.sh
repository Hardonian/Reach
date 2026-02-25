#!/bin/bash
# Audits for remaining hygiene issues
# Usage: ./scripts/maintenance/audit-hygiene.sh

set -e

echo "🔍 Auditing markdown hygiene..."
ISSUES=0

# Check for headers collapsed with subheaders or bold text
# We use grep to find lines matching the pattern
if grep -rE "^#+ [^#]+ +(##| \*\*)" . --include="*.md" --exclude-dir="node_modules" --exclude-dir=".git" --exclude-dir="reach-output"; then
  echo "❌ Hygiene issues found (headers collapsed with content)."
  ISSUES=1
else
  echo "✅ No header collapse issues found."
fi

if [ $ISSUES -eq 0 ]; then
  echo "✨ Hygiene audit passed."
else
  exit 1
fi
