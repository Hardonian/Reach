#!/usr/bin/env bash
set -euo pipefail
if [[ $# -lt 2 ]]; then
  echo "usage: $0 <provider> <tenant>" >&2
  exit 1
fi
provider="$1"
tenant="$2"
secret="$(openssl rand -hex 32)"
echo "New webhook secret generated"
echo "provider=$provider"
echo "tenant=$tenant"
echo "secret=$secret"
