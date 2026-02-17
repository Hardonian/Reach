#!/usr/bin/env bash
set -euo pipefail
if [[ $# -lt 3 ]]; then
  echo "usage: $0 <manifest.json> <private_key.pem> <key_id> [signature_output]" >&2
  exit 1
fi
manifest="$1"
key="$2"
key_id="$3"
out="${4:-$(dirname "$manifest")/manifest.sig}"
sig_b64="$(openssl dgst -sha256 -sign "$key" "$manifest" | base64 -w0)"
cat > "$out" <<JSON
{"key_id":"$key_id","algorithm":"rsa-sha256","signature":"$sig_b64"}
JSON
echo "wrote signature: $out"
