#!/usr/bin/env bash
set -euo pipefail

skip_runner="${SKIP_RUNNER:-0}"

mapfile -t modules < <(find services internal tools -name go.mod -not -path '*/third_party/*' -print | sed 's#/go.mod##' | sort)

for mod in "${modules[@]}"; do
  if [[ "${skip_runner}" == "1" && "${mod}" == "services/runner" ]]; then
    echo "== ${mod} == (skipped: SKIP_RUNNER=1)"
    continue
  fi
  echo "== ${mod} =="
  (
    cd "${mod}"
    go test ./...
  )
done
