#!/usr/bin/env bash
set -euo pipefail

REPO="reach/reach"
BIN_DIR="${REACH_BIN_DIR:-$HOME/.reach/bin}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: required command not found: $1" >&2
    exit 1
  fi
}

detect_platform() {
  local uname_s uname_m
  uname_s="$(uname -s | tr '[:upper:]' '[:lower:]')"
  uname_m="$(uname -m)"

  case "$uname_s" in
    linux*) GOOS="linux" ;;
    darwin*) GOOS="darwin" ;;
    *)
      echo "error: unsupported OS: $uname_s" >&2
      exit 1
      ;;
  esac

  case "$uname_m" in
    x86_64|amd64) GOARCH="amd64" ;;
    arm64|aarch64) GOARCH="arm64" ;;
    *)
      echo "error: unsupported architecture: $uname_m" >&2
      exit 1
      ;;
  esac
}

fetch_latest_version() {
  local latest_url
  latest_url="https://api.github.com/repos/${REPO}/releases/latest"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$latest_url" | sed -n 's/.*"tag_name": "v\([^"]*\)".*/\1/p' | head -n1
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$latest_url" | sed -n 's/.*"tag_name": "v\([^"]*\)".*/\1/p' | head -n1
  fi
}

download_file() {
  local url out
  url="$1"
  out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fL "$url" -o "$out"
  else
    wget -O "$out" "$url"
  fi
}

install_from_release() {
  local version artifact_url sums_url artifact sums expected
  version="${REACH_VERSION:-$(fetch_latest_version || true)}"
  if [[ -z "$version" ]]; then
    return 1
  fi

  artifact="reach_${version}_${GOOS}_${GOARCH}"
  artifact_url="https://github.com/${REPO}/releases/download/v${version}/${artifact}"
  sums_url="https://github.com/${REPO}/releases/download/v${version}/SHA256SUMS"

  echo "Installing Reach v${version} from GitHub releases..."
  download_file "$artifact_url" "$TMP_DIR/reach"
  download_file "$sums_url" "$TMP_DIR/SHA256SUMS"

  expected="$(awk -v target="$artifact" '$2==target {print $1}' "$TMP_DIR/SHA256SUMS")"
  if [[ -z "$expected" ]]; then
    echo "error: checksum entry not found for ${artifact}" >&2
    return 1
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$TMP_DIR/reach" | awk '{print $1}')"
  else
    actual="$(shasum -a 256 "$TMP_DIR/reach" | awk '{print $1}')"
  fi

  if [[ "$actual" != "$expected" ]]; then
    echo "error: checksum verification failed for downloaded artifact" >&2
    exit 1
  fi

  mkdir -p "$BIN_DIR"
  install -m 0755 "$TMP_DIR/reach" "$BIN_DIR/reach"
  ln -sf "$BIN_DIR/reach" "$BIN_DIR/reachctl"
  return 0
}

install_from_source() {
  need_cmd go
  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  if [[ ! -d "$root/.git" ]]; then
    echo "error: local source checkout not found for fallback build" >&2
    exit 1
  fi

  echo "No release artifacts found; building reach locally..."
  mkdir -p "$BIN_DIR"
  (
    cd "$root/services/runner"
    CGO_ENABLED=0 go build -trimpath -o "$BIN_DIR/reach" ./cmd/reachctl
  )
  ln -sf "$BIN_DIR/reach" "$BIN_DIR/reachctl"
}

detect_platform
need_cmd install
if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
  echo "error: curl or wget is required" >&2
  exit 1
fi

if ! install_from_release; then
  install_from_source
fi

cat <<MSG
Installed Reach CLI to: $BIN_DIR/reach
Optional compatibility alias: $BIN_DIR/reachctl
Add this directory to PATH if needed:
  export PATH="$BIN_DIR:\$PATH"
Verify installation:
  reach version
MSG
