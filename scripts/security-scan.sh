#!/usr/bin/env bash
# Reach Security Scanner
# Detects hardcoded secrets, keys, and common vulnerabilities.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Starting Reach Security Scan..."

EXIT_CODE=0

# 1. Check for private keys
echo "Checking for private keys..."
if grep -rE "BEGIN (RSA|EC|PGP|OPENSSH) PRIVATE KEY" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=third_party | grep -v "test" > /dev/null; then
    echo -e "${RED}✖ CRITICAL: Potential private key found!${NC}"
    grep -rE "BEGIN (RSA|EC|PGP|OPENSSH) PRIVATE KEY" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=third_party | grep -v "test"
    EXIT_CODE=1
else
    echo -e "${GREEN}✓ No private keys found outside tests.${NC}"
fi

# 2. Check for generic API keys / tokens
echo "Checking for API tokens..."
# Look for common patterns like apikey=, token=, secret=
if grep -rEi "(api_key|apikey|secret|token|password|bearer|auth)[[:space:]]*[:=][[:space:]]*['\"][a-zA-Z0-9_\-]{16,128}['\"]" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=third_party --exclude=GAP_LIST.md | grep -v "test" > /dev/null; then
    echo -e "${YELLOW}⚠ WARNING: Potential hardcoded secret or token found!${NC}"
    grep -rEi "(api_key|apikey|secret|token|password|bearer|auth)[[:space:]]*[:=][[:space:]]*['\"][a-zA-Z0-9_\-]{16,128}['\"]" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=third_party --exclude=GAP_LIST.md | grep -v "test"
    # We don't fail the build for warnings unless highly confident
else
    echo -e "${GREEN}✓ No obvious API tokens found.${NC}"
fi

# 3. Check for .env files
echo "Checking for .env files..."
if find . -name ".env" -not -path "*/node_modules/*" -not -path "./.git/*" | grep -v ".env.example" > /dev/null; then
    echo -e "${RED}✖ CRITICAL: .env file found! Use .env.example instead.${NC}"
    find . -name ".env" -not -path "*/node_modules/*" -not -path "./.git/*" | grep -v ".env.example"
    EXIT_CODE=1
else
    echo -e "${GREEN}✓ No .env files found.${NC}"
fi

# 4. Check for dangerous Go patterns
echo "Checking for dangerous Go patterns..."
if grep -r "http.ListenAndServe" . --include="*.go" | grep "0.0.0.0" > /dev/null; then
    echo -e "${YELLOW}⚠ WARNING: Found ListenAndServe on 0.0.0.0. Ensure this is intentional.${NC}"
fi

if [[ $EXIT_CODE -eq 0 ]]; then
    echo -e "\n${GREEN}✅ Security scan passed!${NC}"
else
    echo -e "\n${RED}❌ Security scan failed with critical issues.${NC}"
fi

exit $EXIT_CODE
