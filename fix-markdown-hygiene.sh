EERbin/bash
# Fixes markdown hygiene issues identified in logs/hygiene_report_match.txt
# Usage: ./scripts/maintenance/fix-markdown-hygiene.sh

set -e

echo "Running hygiene fixes..."

# Fix 1: Header collapsed with sub-header (e.g., "# Title ## Subtitle" or "## Title ### Subtitle")
# Adds two newlines between them.
# Matches any number of # at start, followed by text, then spaces, then another set of #
find . -type f -name "*.md" -not -path "*/node_modules/*" -not -path "*/.git/*" -exec sed -i -E 's/^((#+) [^#]+) +((#+) )/\1\n\n\3/g' {} +

# Fix 2: Header collapsed with Bold text (e.g., "# Title **Summary" or "## Title **Details")
find . -type f -name "*.md" -not -path "*/node_modules/*" -not -path "*/.git/*" -exec sed -i -E 's/^((#+) [^#]+) +(\*\*)/\1\n\n\3/g' {} +

# Fix 3: Specific file targeting based on logs
# TRUST_NEGOTIATION_SPEC.md
find . -name "TRUST_NEGOTIATION_SPEC.md" -not -path "*/node_modules/*" -exec sed -i 's/Specification ## 1. Overview/Specification\n\n## 1. Overview/' {} +

# README.md
# Improved to handle variable spacing
find . -name "README.md" -not -path "*/node_modules/*" -exec sed -i -E 's/Reach +\*\*Reach/Reach\n\n**Reach/' {} +

echo "✅ Hygiene pass complete."
