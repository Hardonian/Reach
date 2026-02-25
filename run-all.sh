#!/bin/bash
# Orchestrates all maintenance scripts
# Usage: ./scripts/maintenance/run-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔧 Starting full maintenance pass..."

# 1. Restructure Specs (Moves files if they are in root)
"$SCRIPT_DIR/restructure-specs.sh"

# 2. Fix Markdown Hygiene (Titles, spacing)
"$SCRIPT_DIR/fix-markdown-hygiene.sh"

# 3. Fix Broken Links (Updates references to moved files)
"$SCRIPT_DIR/fix-broken-links.sh"

# 4. Verify Structure (Ensures files are where they should be)
"$SCRIPT_DIR/verify-structure.sh"

echo "✨ Maintenance complete."
