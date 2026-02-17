#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION="${1:-$(cat "$ROOT_DIR/VERSION")}"
DIST_DIR="$ROOT_DIR/dist"
TMP_DIR="$DIST_DIR/tmp"

rm -rf "$DIST_DIR"
mkdir -p "$TMP_DIR"

services=(
  runner:cmd/runnerd:runnerd
  runner:cmd/runner-mcp:runner-mcp
  integration-hub:cmd/integration-hub:integration-hub
  session-hub:cmd/session-hub:session-hub
  connector-registry:cmd/connector-registry:connector-registry
  capsule-sync:cmd/capsule-sync:capsule-sync
  ide-bridge:cmd/ide-bridge:ide-bridge
)
platforms=(linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64 windows/arm64)

for svc in "${services[@]}"; do
  IFS=':' read -r service pkg bin <<<"$svc"
  for platform in "${platforms[@]}"; do
    IFS='/' read -r GOOS GOARCH <<<"$platform"
    out="$TMP_DIR/${bin}_${VERSION}_${GOOS}_${GOARCH}"
    [[ "$GOOS" == "windows" ]] && out+=".exe"
    (
      cd "$ROOT_DIR/services/$service"
      CGO_ENABLED=0 GOOS="$GOOS" GOARCH="$GOARCH" go build -trimpath \
        -ldflags "-s -w -X main.version=$VERSION -buildid=" \
        -o "$out" "./$pkg"
    )
  done
done

(
  cd "$TMP_DIR"
  find . -maxdepth 1 -type f -print0 | sort -z | xargs -0 sha256sum > "$DIST_DIR/SHA256SUMS"
)
mv "$TMP_DIR"/* "$DIST_DIR"/
rmdir "$TMP_DIR"

echo "Artifacts written to $DIST_DIR"
