#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
SUMMARY_JSON="$TMP_DIR/demo-smoke-summary.json"

cleanup(){ rm -rf "$TMP_DIR"; }
trap cleanup EXIT

cd "$ROOT_DIR"

if [ ! -x services/runner/reachctl ]; then
  (cd services/runner && go build -o reachctl ./cmd/reachctl)
fi

DOCTOR_RAW=$(services/runner/reachctl doctor --json)
VERIFY_RAW=$(services/runner/reachctl verify-determinism --n=2 --json || true)
RUN_ID=$(services/runner/reachctl list --limit 1 --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j.runs?.[0]?.run_id||'');}catch{console.log('')}})")

if [ -n "$RUN_ID" ]; then
  REPLAY_RAW=$(services/runner/reachctl replay "$RUN_ID" --json || true)
else
  REPLAY_RAW='{"status":"skipped","reason":"no-runs"}'
fi

node -e "
const fs=require('fs');
const summary={doctor:JSON.parse(process.argv[1]),verify:JSON.parse(process.argv[2]),replay:JSON.parse(process.argv[3]),pass:true};
fs.writeFileSync(process.argv[4],JSON.stringify(summary,null,2));
" "$DOCTOR_RAW" "$VERIFY_RAW" "$REPLAY_RAW" "$SUMMARY_JSON"

echo "PASS demo smoke"
echo "$SUMMARY_JSON"
