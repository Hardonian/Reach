#!/usr/bin/env bash
set -euo pipefail

REPO="${REACH_REPO:-reach/reach}"
VERSION="${REACH_VERSION:-}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
REACH_RELEASE_DIR="${REACH_RELEASE_DIR:-}"
REACH_BASE_URL="${REACH_BASE_URL:-}"

detect_platform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$os" in
    linux|darwin) ;;
    *)
      echo "Unsupported OS: $os" >&2
      exit 1
      ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="amd64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)
      echo "Unsupported architecture: $arch" >&2
      exit 1
      ;;
  esac

  echo "${os}-${arch}"
}

fetch_latest_version() {
  if [ -n "$REACH_RELEASE_DIR" ] && [ -f "$REACH_RELEASE_DIR/VERSION" ]; then
    tr -d ' \n\r' <"$REACH_RELEASE_DIR/VERSION"
    return 0
  fi

  curl -fsSL "https://raw.githubusercontent.com/${REPO}/main/VERSION" | tr -d ' \n\r'
}

download_asset() {
  local asset="$1"
  local destination="$2"

  if [ -n "$REACH_RELEASE_DIR" ]; then
    cp "${REACH_RELEASE_DIR}/${asset}" "$destination"
    return 0
  fi

  local base_url
  if [ -n "$REACH_BASE_URL" ]; then
    base_url="$REACH_BASE_URL"
  else
    base_url="https://github.com/${REPO}/releases/download/v${VERSION}"
  fi

  curl -fsSL "${base_url}/${asset}" -o "$destination"
}

verify_checksum() {
  local file="$1"
  local sums_file="$2"
  local expected

  expected="$(grep -E "[[:space:]]${file}$" "$sums_file" | awk '{print $1}')"
  if [ -z "$expected" ]; then
    echo "No checksum entry found for ${file}" >&2
    exit 1
  fi

  local actual=""
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$file" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$file" | awk '{print $1}')"
  else
    echo "No SHA256 tool available (sha256sum/shasum)." >&2
    exit 1
  fi

  if [ "$expected" != "$actual" ]; then
    echo "Checksum mismatch for $(basename "$file")" >&2
    exit 1
  fi
}

install_file() {
  local src="$1"
  local dst="$2"

  if [ -w "$INSTALL_DIR" ]; then
    cp "$src" "$dst"
    chmod +x "$dst"
    return 0
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo cp "$src" "$dst"
    sudo chmod +x "$dst"
    return 0
  fi

  echo "Install directory is not writable: ${INSTALL_DIR}" >&2
  echo "Re-run with INSTALL_DIR set to a writable path or use sudo." >&2
  exit 1
}

main() {
  if [ -z "$VERSION" ]; then
    VERSION="$(fetch_latest_version)"
  fi
  if [ -z "$VERSION" ]; then
    echo "Could not resolve Reach version. Set REACH_VERSION." >&2
    exit 1
  fi

  local platform binary tmp_dir sums_file
  platform="$(detect_platform)"
  binary="reachctl-${platform}"
  tmp_dir="$(mktemp -d)"
  sums_file="${tmp_dir}/SHA256SUMS"
  trap 'rm -rf "$tmp_dir"' EXIT

  echo "Installing Reach v${VERSION} (${platform})..."
  download_asset "$binary" "${tmp_dir}/${binary}"
  download_asset "reach" "${tmp_dir}/reach"
  download_asset "SHA256SUMS" "$sums_file"

  verify_checksum "${tmp_dir}/${binary}" "$sums_file"
  verify_checksum "${tmp_dir}/reach" "$sums_file"

  if [ ! -d "$INSTALL_DIR" ]; then
    if [ -w "$(dirname "$INSTALL_DIR")" ]; then
      mkdir -p "$INSTALL_DIR"
    elif command -v sudo >/dev/null 2>&1; then
      sudo mkdir -p "$INSTALL_DIR"
    else
      echo "Cannot create install directory: ${INSTALL_DIR}" >&2
      exit 1
    fi
  fi

  install_file "${tmp_dir}/${binary}" "${INSTALL_DIR}/reachctl"
  install_file "${tmp_dir}/reach" "${INSTALL_DIR}/reach"

  echo "Reach installed to ${INSTALL_DIR}"
  echo "Run: ${INSTALL_DIR}/reach version"
  echo "Then: ${INSTALL_DIR}/reach doctor"
}

main "$@"

