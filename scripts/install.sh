#!/usr/bin/env bash
set -euo pipefail

# Reach Installation Script
# Supports: Linux, macOS
# Prerequisites: Node.js 18+, pnpm, Git

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_error "required command not found: $1"
    echo ""
    echo "Please install $1:"
    case "$1" in
      node)
        echo "  - Via nvm: https://github.com/nvm-sh/nvm"
        echo "  - Via package manager: https://nodejs.org/"
        ;;
      pnpm)
        echo "  - npm install -g pnpm"
        echo "  - Via standalone: https://pnpm.io/installation"
        ;;
      git)
        echo "  - Via package manager or https://git-scm.com/"
        ;;
      cargo)
        echo "  - Via rustup: https://rustup.rs/"
        echo "  - Required only for building Requiem engine from source"
        ;;
    esac
    exit 1
  fi
}

check_version() {
  local cmd min_version current_version
  cmd="$1"
  min_version="$2"

  current_version="$($cmd --version | head -n1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)"

  # Simple version comparison (major.minor only)
  local current_major current_minor min_major min_minor
  current_major="$(echo "$current_version" | cut -d. -f1)"
  current_minor="$(echo "$current_version" | cut -d. -f2)"
  min_major="$(echo "$min_version" | cut -d. -f1)"
  min_minor="$(echo "$min_version" | cut -d. -f2)"

  if [[ "$current_major" -lt "$min_major" ]] || \
     ([[ "$current_major" -eq "$min_major" ]] && [[ "$current_minor" -lt "$min_minor" ]]); then
    log_warn "$cmd version $current_version is older than recommended $min_version"
    return 1
  fi

  log_info "$cmd version $current_version ✓"
  return 0
}

install_node_deps() {
  log_step "Installing Node.js dependencies..."
  cd "$PROJECT_ROOT"

  if [[ ! -f "pnpm-lock.yaml" ]]; then
    log_warn "No pnpm-lock.yaml found, using npm package-lock.json"
  fi

  pnpm install --frozen-lockfile || pnpm install

  log_info "Node.js dependencies installed"
}

build_rust_engine() {
  if ! command -v cargo >/dev/null 2>&1; then
    log_warn "Rust/Cargo not found. Skipping Requiem engine build."
    log_warn "The TypeScript fallback will be used (slower but functional)."
    return 0
  fi

  log_step "Building Requiem engine (Rust)..."
  cd "$PROJECT_ROOT"

  # Build the release version
  if cargo build --release -p requiem 2>/dev/null; then
    log_info "Requiem engine built successfully"

    # Create .reach/bin directory
    mkdir -p "$PROJECT_ROOT/.reach/bin"

    # Copy binary to predictable location
    local binary_path
    binary_path="$PROJECT_ROOT/target/release/requiem"
    if [[ -f "$binary_path" ]]; then
      cp "$binary_path" "$PROJECT_ROOT/.reach/bin/requiem"
      chmod +x "$PROJECT_ROOT/.reach/bin/requiem"
      log_info "Requiem binary: $PROJECT_ROOT/.reach/bin/requiem"
    fi
  else
    log_warn "Requiem engine build failed. TypeScript fallback will be used."
  fi
}

setup_environment() {
  log_step "Setting up environment..."

  # Create .reach directory structure
  mkdir -p "$PROJECT_ROOT/.reach/bin"
  mkdir -p "$PROJECT_ROOT/.reach/data"
  mkdir -p "$PROJECT_ROOT/.reach/logs"

  # Create local config if it doesn't exist
  if [[ ! -f "$PROJECT_ROOT/.reach/config.json" ]]; then
    cat > "$PROJECT_ROOT/.reach/config.json" <<'EOF'
{
  "version": "0.3.1",
  "engine": {
    "default": "auto",
    "fallback": "typescript"
  },
  "protocol": {
    "version": 1,
    "default": "json"
  },
  "determinism": {
    "hash": "blake3",
    "precision": 10
  }
}
EOF
    log_info "Created default config: .reach/config.json"
  fi

  # Add .reach/bin to PATH if not present
  if [[ ":$PATH:" != *":$PROJECT_ROOT/.reach/bin:"* ]]; then
    log_info "Add to your shell profile to use reach command:"
    echo "  export PATH=\"$PROJECT_ROOT/.reach/bin:\$PATH\""
  fi
}

run_verification() {
  log_step "Running verification..."
  cd "$PROJECT_ROOT"

  if pnpm run typecheck >/dev/null 2>&1; then
    log_info "TypeScript type check passed"
  else
    log_warn "TypeScript type check has warnings (see pnpm run typecheck)"
  fi

  if pnpm run lint >/dev/null 2>&1; then
    log_info "Lint check passed"
  else
    log_warn "Lint check has warnings"
  fi
}

# =============================================================================
# Main
# =============================================================================

log_info "Reach Installation Script"
log_info "Project: $PROJECT_ROOT"
echo ""

# Check prerequisites
log_step "Checking prerequisites..."
need_cmd git
need_cmd node
need_cmd pnpm

check_version node 18.0 || true
check_version pnpm 8.0 || true

if command -v cargo >/dev/null 2>&1; then
  check_version cargo 1.75 || true
fi

echo ""

# Run installation steps
install_node_deps
build_rust_engine
setup_environment
run_verification

echo ""
log_info "Installation complete!"
echo ""
echo "Next steps:"
echo "  1. pnpm verify:fast    # Quick validation"
echo "  2. pnpm verify:smoke   # Smoke test"
echo "  3. pnpm verify         # Full verification"
echo ""
echo "Documentation:"
echo "  - docs/GO_LIVE.md      # Go-live guide"
echo "  - docs/ARCHITECTURE.md # System design"
echo ""
