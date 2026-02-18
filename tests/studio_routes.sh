#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/arcade"
PORT="${STUDIO_TEST_PORT:-3210}"

cd "$APP_DIR"
npm run dev -- --hostname 127.0.0.1 --port "$PORT" >/tmp/reach-studio-dev.log 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

studio_page="$(curl -fsS "http://127.0.0.1:${PORT}/studio")"
if [[ "$studio_page" != *"Reach Studio"* ]]; then
  echo "Expected /studio to render Reach Studio"
  exit 1
fi

unsupported_code="$(curl -s -o /tmp/reach-studio-unsupported.json -w '%{http_code}' \
  -X POST "http://127.0.0.1:${PORT}/api/studio/command" \
  -H 'content-type: application/json' \
  --data '{"command":"invalid.command"}')"
if [[ "$unsupported_code" != "400" ]]; then
  echo "Expected unsupported command to return 400; got $unsupported_code"
  cat /tmp/reach-studio-unsupported.json
  exit 1
fi

inventory="$(curl -fsS -X POST "http://127.0.0.1:${PORT}/api/studio/command" -H 'content-type: application/json' --data '{"command":"runs.inventory"}')"
if [[ "$inventory" != *'"runs"'* ]]; then
  echo "Expected runs.inventory response to include runs"
  echo "$inventory"
  exit 1
fi


state_get="$(curl -fsS "http://127.0.0.1:${PORT}/api/studio/state")"
if [[ "$state_get" != *'"packDraft"'* ]]; then
  echo "Expected /api/studio/state GET to return packDraft"
  echo "$state_get"
  exit 1
fi

state_post_code="$(curl -s -o /tmp/reach-studio-state-post.json -w '%{http_code}' \
  -X POST "http://127.0.0.1:${PORT}/api/studio/state" \
  -H 'content-type: application/json' \
  --data '{"state":{"packDraft":{"name":"governed-starter","specVersion":"1.0","policyContract":"policy/default.contract.json","tests":["tests/conformance.policy.json"]},"runHistory":[{"command":"runs.inventory","timestamp":"1970-01-01T00:00:00.000Z","ok":true}]}}')"
if [[ "$state_post_code" != "200" ]]; then
  echo "Expected state POST to return 200; got $state_post_code"
  cat /tmp/reach-studio-state-post.json
  exit 1
fi
echo "Studio route and command API checks passed."
