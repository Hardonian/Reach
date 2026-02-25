#!/bin/bash
# Fixes markdown hygiene issues identified in logs/hygiene_report_match.txt
# Usage: ./scripts/maintenance/fix-markdown-hygiene.sh

set -e

echo "Running hygiene fixes..."

# Fix 1: H1 collapsed with H2 (e.g., "# Title ## Subtitle")
# Adds two newlines between them.
sed -i -E 's/^(# [^#]+) (## )/\1\n\n\2/g' *.md 2>/dev/null || true

# Fix 2: H1 collapsed with Bold text (e.g., "# Title **Summary")
sed -i -E 's/^(# [^#]+)  (\*\*)/\1\n\n\2/g' *.md 2>/dev/null || true

# Fix 3: Specific file targeting based on logs
# TRUST_NEGOTIATION_SPEC.md
if [ -f "TRUST_NEGOTIATION_SPEC.md" ]; then
  sed -i 's/Specification ## 1. Overview/Specification\n\n## 1. Overview/' TRUST_NEGOTIATION_SPEC.md
fi

# README.md
if [ -f "README.md" ]; then
  sed -i 's/Reach  \*\*Reach/Reach\n\n**Reach/' README.md
fi

echo "✅ Hygiene pass complete."
