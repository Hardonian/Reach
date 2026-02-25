#!/bin/bash
# Fixes markdown hygiene issues identified in logs/hygiene_report_match.txt
# Usage: ./scripts/maintenance/fix-markdown-hygiene.sh

set -e

echo "Running hygiene fixes..."

# Fix 1: H1 collapsed with H2 (e.g., "# Title ## Subtitle")
# Adds two newlines between them.
find . -type f -name "*.md" -not -path "*/node_modules/*" -not -path "*/.git/*" -exec sed -i -E 's/^(# [^#]+) (## )/\1\n\n\2/g' {} +

# Fix 2: H1 collapsed with Bold text (e.g., "# Title **Summary")
find . -type f -name "*.md" -not -path "*/node_modules/*" -not -path "*/.git/*" -exec sed -i -E 's/^(# [^#]+)  (\*\*)/\1\n\n\2/g' {} +

# Fix 3: Specific file targeting based on logs
# TRUST_NEGOTIATION_SPEC.md
find . -name "TRUST_NEGOTIATION_SPEC.md" -not -path "*/node_modules/*" -exec sed -i 's/Specification ## 1. Overview/Specification\n\n## 1. Overview/' {} +

# README.md
find . -name "README.md" -not -path "*/node_modules/*" -exec sed -i 's/Reach  \*\*Reach/Reach\n\n**Reach/' {} +

echo "✅ Hygiene pass complete."
