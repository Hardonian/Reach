#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/services/runner"

for d in "$ROOT"/packs/*; do
  [[ -d "$d" ]] || continue
  PACK_JSON="$d/pack.json"
  if [[ ! -f "$PACK_JSON" ]]; then
    echo "skip $d (no pack.json)"
    continue
  fi
  if python - "$PACK_JSON" <<'PY'
import json,sys
p=sys.argv[1]
obj=json.load(open(p))
valid=isinstance(obj.get('metadata'),dict) and isinstance(obj.get('execution_graph'),dict)
raise SystemExit(0 if valid else 1)
PY
  then
    go run ./cmd/reachctl pack validate "$d" --json
  else
    echo "skip $d (non-devkit manifest format)"
  fi
done

echo "pack validation completed"
