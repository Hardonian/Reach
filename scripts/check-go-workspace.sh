#!/usr/bin/env bash
set -euo pipefail

workspace_file="go.work"
if [[ ! -f "$workspace_file" ]]; then
  echo "go.work not found"
  exit 1
fi

mapfile -t modules < <(awk '
  /^use \(/ { in_use=1; next }
  in_use && /^\)/ { in_use=0; next }
  in_use {
    gsub(/^[ \t]+|[ \t]+$/, "", $0)
    gsub(/"/, "", $0)
    if ($0 != "") print $0
  }
  /^use [^\(]/ {
    sub(/^use[ \t]+/, "")
    gsub(/"/, "")
    gsub(/^[ \t]+|[ \t]+$/, "")
    if ($0 != "") print $0
  }
' "$workspace_file")

if [[ ${#modules[@]} -eq 0 ]]; then
  echo "No modules declared in go.work"
  exit 1
fi

for module in "${modules[@]}"; do
  if [[ ! -f "$module/go.mod" ]]; then
    echo "Skipping $module (go.mod missing)"
    continue
  fi

  echo "==> Go vet: $module"
  (cd "$module" && go vet ./...)

  echo "==> Go test: $module"
  (cd "$module" && go test ./...)
done
