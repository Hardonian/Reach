#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${REACH_BASE_URL:-http://localhost:8080}"
COOKIE_JAR="$(mktemp)"

curl -sS -c "$COOKIE_JAR" -X POST "$BASE_URL/auth/dev-login" -H 'content-type: application/json' -d '{}' >/dev/null

PUBKEY="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
CHALLENGE=$(curl -sS -b "$COOKIE_JAR" -X POST "$BASE_URL/v1/mobile/handshake/challenge" -H 'content-type: application/json' -d "{\"node_id\":\"mobile-smoke\",\"org_id\":\"dev\",\"public_key\":\"$PUBKEY\"}" | sed -n 's/.*"challenge":"\([^"]*\)".*/\1/p')
[ -n "$CHALLENGE" ]

RUN_ID=$(curl -sS -b "$COOKIE_JAR" -X POST "$BASE_URL/v1/runs" -H 'content-type: application/json' -d '{"capabilities":["tool:echo"],"plan_tier":"free"}' | sed -n 's/.*"run_id":"\([^"]*\)".*/\1/p')
[ -n "$RUN_ID" ]

curl -sS -b "$COOKIE_JAR" "$BASE_URL/v1/mobile/runs/$RUN_ID" >/dev/null
TOKEN=$(curl -sS -b "$COOKIE_JAR" -X POST "$BASE_URL/v1/mobile/share-tokens" -H 'content-type: application/json' -d "{\"run_id\":\"$RUN_ID\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ]
curl -sS "$BASE_URL/v1/mobile/share/$TOKEN" >/dev/null

echo "mobile smoke passed"
