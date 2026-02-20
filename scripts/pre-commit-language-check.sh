#!/usr/bin/env bash
# Pre-commit hook: enforce canonical language in staged UI files.
# Install: cp scripts/pre-commit-language-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -euo pipefail

# Only run if UI-layer files are staged
UI_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '^(apps/arcade/src|extensions/vscode/src)/' | grep -E '\.(ts|tsx|js|jsx)$' || true)

if [ -z "$UI_FILES" ]; then
  exit 0
fi

echo "pre-commit: checking canonical language in staged UI files..."
npx tsx scripts/enforce-canonical-language.ts
