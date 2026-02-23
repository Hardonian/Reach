#!/bin/bash
# Alternative: Shrink repo using BFG Repo-Cleaner
# BFG is faster than filter-branch for large repositories
# Download from: https://rtyley.github.io/bfg-repo-cleaner/

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       Reach Repo Cleanup using BFG Repo-Cleaner                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check for BFG
if ! command -v bfg &> /dev/null; then
    echo "BFG not found. Download it:"
    echo "  wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"
    echo "  chmod +x bfg-1.14.0.jar"
    echo "  alias bfg='java -jar bfg-1.14.0.jar'"
    echo ""
    echo "Or install via package manager:"
    echo "  brew install bfg        # macOS"
    echo "  scoop install bfg       # Windows"
    exit 1
fi

echo "Current size:"
du -sh .git
echo ""

# Show what would be removed
echo "Files that will be removed from history:"
bfg --strip-blobs-bigger-than 10M --dry-run .
echo ""

read -p "Continue with BFG cleanup? [yes/no]: " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

# Create backup
git branch backup-bfg-$(date +%Y%m%d) || true

# Run BFG
echo "Running BFG..."
bfg --strip-blobs-bigger-than 10M .

# Clean up
echo "Cleaning up..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "New size:"
du -sh .git
echo ""
echo "Done! Force push when ready:"
echo "  git push --force"
