#!/bin/bash
# Shrink Reach repository by removing large binaries from git history
# WARNING: This rewrites git history and changes commit hashes!

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          Reach Repository Size Reduction Script                ║"
echo "║                                                                ║"
echo "║  WARNING: This will rewrite git history!                       ║"
echo "║  All commit hashes will change.                                ║"
echo "║  Coordinate with team before running.                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Safety check: Ensure we're in the repo root
if [ ! -d ".git" ]; then
    echo -e "${RED}Error: Must run from repository root${NC}"
    exit 1
fi

# Check if git-filter-repo is available
if command -v git-filter-repo &> /dev/null; then
    USE_FILTER_REPO=true
    echo -e "${GREEN}✓ git-filter-repo found (recommended)${NC}"
else
    USE_FILTER_REPO=false
    echo -e "${YELLOW}⚠ git-filter-repo not found, will use filter-branch${NC}"
    echo "  Install git-filter-repo for better performance:"
    echo "    pip install git-filter-repo"
    echo ""
fi

# Show current repo size
echo "Current repository size:"
du -sh .git
echo ""

# List largest blobs before cleanup
echo "Top 20 largest files in history:"
git rev-list --objects --all | \
    git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
    awk '$1 == "blob" {print $3, $4}' | \
    sort -rn | \
    head -20 | \
    numfmt --field=1 --to=iec
echo ""

# Confirm with user
read -p "⚠️  This will PERMANENTLY ALTER git history. Continue? [yes/no]: " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Creating backup branch..."
git branch backup-before-shrink-$(date +%Y%m%d) || true
echo -e "${GREEN}✓ Backup branch created: backup-before-shrink-$(date +%Y%m%d)${NC}"
echo ""

# Remove large blobs based on size threshold
SIZE_THRESHOLD="10M"
echo "Removing blobs larger than $SIZE_THRESHOLD..."

if [ "$USE_FILTER_REPO" = true ]; then
    # Modern approach using git-filter-repo (much faster)
    git filter-repo \
        --strip-blobs-bigger-than "$SIZE_THRESHOLD" \
        --force
else
    # Legacy approach using filter-branch
    echo "Using filter-branch (this may take a while)..."
    
    # Remove .exe files from history
    git filter-branch --force --index-filter \
        'git rm --cached --ignore-unmatch -r *.exe' \
        --prune-empty --tag-name-filter cat -- --all
    
    # Remove .zip files from history
    git filter-branch --force --index-filter \
        'git rm --cached --ignore-unmatch -r *.zip' \
        --prune-empty --tag-name-filter cat -- --all
    
    # Remove large test binaries
    git filter-branch --force --index-filter \
        'git rm --cached --ignore-unmatch -r *.test' \
        --prune-empty --tag-name-filter cat -- --all
fi

echo ""
echo "Cleaning up refs and garbage collecting..."

# Remove old refs
rm -rf .git/refs/original/
git reflog expire --expire=now --all

# Aggressive garbage collection
git gc --prune=now --aggressive

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}Repository size reduction complete!${NC}"
echo ""
echo "New repository size:"
du -sh .git
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo ""
echo "1. VERIFY everything still works:"
echo "     make test"
echo "     make verify"
echo ""
echo "2. FORCE PUSH to remote (⚠️  COORDINATE WITH TEAM):"
echo "     git push origin --force --all"
echo "     git push origin --force --tags"
echo ""
echo "3. Team members will need to reclone or run:"
echo "     git fetch origin"
echo "     git reset --hard origin/main"
echo ""
echo "4. If anything goes wrong, restore from backup:"
echo "     git reset --hard backup-before-shrink-$(date +%Y%m%d)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
