#!/usr/bin/env bash
# ============================================================
# Reach Cloud Smoke Test
# Usage: REACH_CLOUD_ENABLED=true bash scripts/smoke-cloud.sh
# ============================================================
set -euo pipefail

BASE="${REACH_CLOUD_BASE:-http://localhost:3000}"
FAIL=0
PASS=0

c_green="\033[0;32m"
c_red="\033[0;31m"
c_reset="\033[0m"
c_bold="\033[1m"

pass() { echo -e "${c_green}✓${c_reset} $1"; ((PASS++)); }
fail() { echo -e "${c_red}✗${c_reset} $1"; ((FAIL++)); }
header() { echo -e "\n${c_bold}── $1 ──${c_reset}"; }

# ── Check server is running ──────────────────────────────────
header "Pre-flight"
if ! curl -sf "${BASE}" -o /dev/null; then
  echo -e "${c_red}ERROR: Server not running at ${BASE}${c_reset}"
  echo "Start with: cd apps/arcade && npm run dev"
  exit 1
fi
pass "Server reachable at ${BASE}"

# ── Seed dev data ─────────────────────────────────────────────
header "Seed"
SEED=$(curl -sf -X POST "${BASE}/api/v1/seed" \
  -H "Content-Type: application/json" || echo '{"error":"seed failed"}')
echo "${SEED}" | python3 -m json.tool 2>/dev/null || echo "${SEED}"
if echo "${SEED}" | grep -q '"ok":true'; then
  pass "Seed endpoint OK"
  API_KEY=$(echo "${SEED}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('api_key',''))" 2>/dev/null || echo "")
else
  fail "Seed endpoint failed"
  API_KEY=""
fi

# ── Auth ─────────────────────────────────────────────────────
header "Auth"
LOGIN=$(curl -sf -X POST "${BASE}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@reach.dev","password":"dev-password-local"}' \
  -c /tmp/reach-cookies.txt || echo '{"error":"login failed"}')
if echo "${LOGIN}" | grep -q '"email"'; then
  pass "Login OK"
  TENANT_ID=$(echo "${LOGIN}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tenant',{}).get('id',''))" 2>/dev/null || echo "")
else
  fail "Login failed: ${LOGIN}"
  TENANT_ID=""
fi

# Set auth headers
AUTH_HEADER="Authorization: Bearer ${API_KEY}"
TENANT_HEADER="X-Tenant-Id: ${TENANT_ID}"

# ── Me endpoint ───────────────────────────────────────────────
ME=$(curl -sf "${BASE}/api/v1/auth/me" \
  -H "${AUTH_HEADER}" -H "${TENANT_HEADER}" || echo '{}')
if echo "${ME}" | grep -q '"email"'; then
  pass "GET /auth/me OK"
else
  fail "GET /auth/me failed"
fi

# ── Tenants ────────────────────────────────────────────────────
header "Tenants & Projects"
TENANTS=$(curl -sf "${BASE}/api/v1/tenants" \
  -H "${AUTH_HEADER}" -H "${TENANT_HEADER}" || echo '{}')
if echo "${TENANTS}" | grep -q '"tenants"'; then
  pass "GET /tenants OK"
else
  fail "GET /tenants failed"
fi

PROJ=$(curl -sf -X POST "${BASE}/api/v1/projects" \
  -H "Content-Type: application/json" -H "${AUTH_HEADER}" -H "${TENANT_HEADER}" \
  -d '{"name":"Smoke Test Project","description":"Created by smoke test"}' || echo '{}')
if echo "${PROJ}" | grep -q '"id"'; then
  pass "POST /projects OK"
  PROJECT_ID=$(echo "${PROJ}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('project',{}).get('id',''))" 2>/dev/null || echo "")
else
  fail "POST /projects failed: ${PROJ}"
  PROJECT_ID=""
fi

# ── Workflows ─────────────────────────────────────────────────
header "Workflows"
WF_BODY='{"name":"Smoke Test Workflow","description":"Auto-created","graph":{"nodes":[{"id":"n1","type":"trigger","name":"Start","inputs":{},"config":{},"outputs":{}},{"id":"n2","type":"agent","name":"Process","inputs":{},"config":{"model":"test"},"outputs":{}},{"id":"n3","type":"output","name":"Done","inputs":{},"config":{},"outputs":{}}],"edges":[{"from":"n1","to":"n2"},{"from":"n2","to":"n3"}],"triggers":[{"type":"manual"}],"policies":[],"version":1}}'
WF=$(curl -sf -X POST "${BASE}/api/v1/workflows" \
  -H "Content-Type: application/json" -H "${AUTH_HEADER}" -H "${TENANT_HEADER}" \
  -d "${WF_BODY}" || echo '{}')
if echo "${WF}" | grep -q '"id"'; then
  pass "POST /workflows OK"
  WF_ID=$(echo "${WF}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('workflow',{}).get('id',''))" 2>/dev/null || echo "")
else
  fail "POST /workflows failed: ${WF}"
  WF_ID=""
fi

WFS=$(curl -sf "${BASE}/api/v1/workflows" \
  -H "${AUTH_HEADER}" -H "${TENANT_HEADER}" || echo '{}')
if echo "${WFS}" | grep -q '"workflows"'; then
  pass "GET /workflows OK"
else
  fail "GET /workflows failed"
fi

# ── Workflow Run ──────────────────────────────────────────────
header "Workflow Runs"
if [ -n "${WF_ID}" ]; then
  RUN=$(curl -sf -X POST "${BASE}/api/v1/workflows/${WF_ID}/runs" \
    -H "Content-Type: application/json" -H "${AUTH_HEADER}" -H "${TENANT_HEADER}" \
    -d '{"inputs":{}}' || echo '{}')
  if echo "${RUN}" | grep -q '"id"'; then
    pass "POST /workflows/:id/runs OK"
    RUN_ID=$(echo "${RUN}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('run',{}).get('id',''))" 2>/dev/null || echo "")
    sleep 2
    RUN_DETAIL=$(curl -sf "${BASE}/api/v1/workflow-runs/${RUN_ID}" \
      -H "${AUTH_HEADER}" -H "${TENANT_HEADER}" || echo '{}')
    if echo "${RUN_DETAIL}" | grep -q '"run"'; then
      pass "GET /workflow-runs/:id OK"
    else
      fail "GET /workflow-runs/:id failed"
    fi
  else
    fail "POST /workflows/:id/runs failed: ${RUN}"
  fi
fi

RUNS=$(curl -sf "${BASE}/api/v1/workflow-runs" \
  -H "${AUTH_HEADER}" -H "${TENANT_HEADER}" || echo '{}')
if echo "${RUNS}" | grep -q '"runs"'; then
  pass "GET /workflow-runs OK"
else
  fail "GET /workflow-runs failed"
fi

# ── Marketplace ───────────────────────────────────────────────
header "Marketplace"
MKT=$(curl -sf "${BASE}/api/v1/marketplace" || echo '{}')
if echo "${MKT}" | grep -q '"packs"'; then
  pass "GET /marketplace OK"
else
  fail "GET /marketplace failed: ${MKT}"
fi

# Publish a test pack
PUB=$(curl -sf -X POST "${BASE}/api/v1/marketplace/publish" \
  -H "Content-Type: application/json" -H "${AUTH_HEADER}" -H "${TENANT_HEADER}" \
  -d '{"name":"Smoke Test Pack","slug":"smoke-test-pack","description":"A pack published by the smoke test suite","version":"1.0.0","category":"general","visibility":"public","tools":["console.log"],"tags":["test"],"permissions":[],"dataHandling":"minimal","authorName":"Smoke Bot","readme":"# Smoke Test Pack\n\nThis pack is for testing.","changelog":"Initial release","shortDescription":"Smoke test pack"}' \
  || echo '{}')
if echo "${PUB}" | grep -q '"ok":true'; then
  pass "POST /marketplace/publish OK"
else
  fail "POST /marketplace/publish failed: ${PUB}"
fi

# ── Billing ───────────────────────────────────────────────────
header "Billing"
BILL=$(curl -sf "${BASE}/api/v1/billing" \
  -H "${AUTH_HEADER}" -H "${TENANT_HEADER}" || echo '{}')
if echo "${BILL}" | grep -q '"plan"'; then
  pass "GET /billing OK"
else
  fail "GET /billing failed: ${BILL}"
fi

# ── API Keys ──────────────────────────────────────────────────
header "API Keys"
KEYS=$(curl -sf "${BASE}/api/v1/api-keys" \
  -H "${AUTH_HEADER}" -H "${TENANT_HEADER}" || echo '{}')
if echo "${KEYS}" | grep -q '"api_keys"'; then
  pass "GET /api-keys OK"
else
  fail "GET /api-keys failed"
fi

NEW_KEY=$(curl -sf -X POST "${BASE}/api/v1/api-keys" \
  -H "Content-Type: application/json" -H "${AUTH_HEADER}" -H "${TENANT_HEADER}" \
  -d '{"name":"smoke-test-key","scopes":["runs:read"]}' || echo '{}')
if echo "${NEW_KEY}" | grep -q '"raw_key"'; then
  pass "POST /api-keys OK"
else
  fail "POST /api-keys failed: ${NEW_KEY}"
fi

# ── Audit ─────────────────────────────────────────────────────
header "Audit Log"
AUDIT=$(curl -sf "${BASE}/api/v1/audit" \
  -H "${AUTH_HEADER}" -H "${TENANT_HEADER}" || echo '{}')
if echo "${AUDIT}" | grep -q '"events"'; then
  pass "GET /audit OK"
  EVENT_COUNT=$(echo "${AUDIT}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('events',[])))" 2>/dev/null || echo "?")
  echo "  → ${EVENT_COUNT} audit events recorded"
else
  fail "GET /audit failed"
fi

# ── Summary ───────────────────────────────────────────────────
echo -e "\n${c_bold}══ Smoke Test Results ══${c_reset}"
echo -e "${c_green}PASS: ${PASS}${c_reset}   ${c_red}FAIL: ${FAIL}${c_reset}"
if [ "${FAIL}" -gt 0 ]; then
  echo -e "\n${c_red}Some tests failed. Check server logs.${c_reset}"
  exit 1
else
  echo -e "\n${c_green}All tests passed!${c_reset}"
fi
