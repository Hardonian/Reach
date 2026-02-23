#!/bin/bash
# Remove committed binaries from git tracking
# This script removes binaries that should not be in the repo

set -e

echo "Removing committed binaries from git tracking..."

# Main binaries
git rm --cached -f reachctl.exe 2>/dev/null || true
git rm --cached -f services/runner/reachctl.exe 2>/dev/null || true
git rm --cached -f services/runner/cmd/reachctl/reachctl.exe 2>/dev/null || true
git rm --cached -f services/runner/reach-serve.exe 2>/dev/null || true
git rm --cached -f services/runner/reach-eval.exe 2>/dev/null || true

# Test binaries
git rm --cached -f services/runner/*.test.exe 2>/dev/null || true
git rm --cached -f services/runner/cmd/reachctl/reachctl.test.exe 2>/dev/null || true

# Tool binaries
git rm --cached -f tools/doctor/doctor.exe 2>/dev/null || true
git rm --cached -f tools/doctor/doctor_test.exe 2>/dev/null || true
git rm --cached -f tools/packkit/packkit.exe 2>/dev/null || true
git rm --cached -f tools/perf/perf.exe 2>/dev/null || true

# Service binaries
git rm --cached -f services/connector-registry/connector-registry.exe 2>/dev/null || true
git rm --cached -f services/integration-hub/integration-hub.exe 2>/dev/null || true
git rm --cached -f services/session-hub/session-hub.exe 2>/dev/null || true

echo "Binaries removed from git tracking."
echo "The files remain locally but will not be committed."
echo ""
echo "To completely remove them from history (requires force push):"
echo "  git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch *.exe' HEAD"
