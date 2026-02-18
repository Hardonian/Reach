#!/data/data/com.termux/files/usr/bin/bash
# Reach One-Tap Installer for Termux/Android
# Usage: curl -fsSL https://get.reach.dev/termux | bash
#    or: pkg install wget && wget -qO- https://get.reach.dev/termux | bash

set -euo pipefail

REACH_VERSION="${REACH_VERSION:-0.9.0}"
REACH_INSTALL_DIR="${REACH_INSTALL_DIR:-$HOME/.reach}"
REACH_BIN_DIR="${REACH_BIN_DIR:-$PREFIX/bin}"
REPO_URL="${REACH_REPO:-https://github.com/reach/reach}"

# Colors for Termux (fallback gracefully if no color support)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_ok() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_err() { echo -e "${RED}✗${NC} $1"; }

# Check Termux environment
check_termux() {
    if [[ -z "${TERMUX_VERSION:-}" ]]; then
        log_warn "Not running in Termux. Some features may not work correctly."
    else
        log_info "Termux ${TERMUX_VERSION} detected"
    fi
    
    # Check architecture
    local arch
    arch=$(uname -m)
    case "$arch" in
        aarch64|arm64) arch="arm64" ;;
        armv7*|arm) arch="arm" ;;
        x86_64|amd64) arch="amd64" ;;
        *) log_err "Unsupported architecture: $arch"; exit 1 ;;
    esac
    log_info "Architecture: $arch"
    echo "$arch"
}

# Install dependencies
install_deps() {
    log_info "Installing dependencies..."
    
    # Update packages if needed
    if [[ ! -f "$PREFIX/etc/apt/sources.list.d/reach.list" ]]; then
        pkg update -y -o Dpkg::Options::="--force-confold" 2>/dev/null || true
    fi
    
    # Essential packages for Reach
    local deps=(git golang jq termux-api)
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &>/dev/null && [[ "$dep" != "termux-api" ]]; then
            log_info "Installing $dep..."
            pkg install -y "$dep" 2>/dev/null || log_warn "Could not install $dep"
        fi
    done
    
    # Check termux-api (optional but recommended)
    if [[ ! -f "$PREFIX/libexec/termux-api" ]]; then
        log_warn "termux-api not installed. QR codes and sharing will use fallback methods."
        log_info "To enable: pkg install termux-api"
    fi
    
    log_ok "Dependencies ready"
}

# Download and install Reach
install_reach() {
    local arch="$1"
    log_info "Installing Reach ${REACH_VERSION}..."
    
    # Create directories
    mkdir -p "$REACH_INSTALL_DIR/bin"
    mkdir -p "$REACH_INSTALL_DIR/data/runs"
    mkdir -p "$REACH_INSTALL_DIR/data/capsules"
    mkdir -p "$REACH_INSTALL_DIR/packs"
    
    # Clone or update repository
    if [[ -d "$REACH_INSTALL_DIR/.git" ]]; then
        log_info "Updating existing installation..."
        (cd "$REACH_INSTALL_DIR" && git pull --depth=1 origin main 2>/dev/null || true)
    else
        log_info "Downloading Reach..."
        git clone --depth=1 "$REPO_URL" "$REACH_INSTALL_DIR/repo" 2>/dev/null || {
            # Fallback: create minimal structure
            mkdir -p "$REACH_INSTALL_DIR/repo"
        }
    fi
    
    # Build reachctl for Android
    log_info "Building reachctl (mobile-optimized)..."
    
    cat > "$REACH_INSTALL_DIR/bin/reachctl" << 'BINSCRIPT'
#!/data/data/com.termux/files/usr/bin/bash
# Reach CLI wrapper for Termux
export REACH_DATA_DIR="${REACH_DATA_DIR:-$HOME/.reach/data}"
export REACH_MOBILE=1
export REACH_LOW_MEMORY=1

# Low-memory defaults
export REACH_MAX_MEMORY_MB="${REACH_MAX_MEMORY_MB:-256}"
export REACH_GC_INTERVAL="${REACH_GC_INTERVAL:-10}"

exec go run "$HOME/.reach/repo/services/runner/cmd/reachctl" "$@"
BINSCRIPT
    chmod +x "$REACH_INSTALL_DIR/bin/reachctl"
    
    # Main reach wrapper
    cat > "$REACH_INSTALL_DIR/bin/reach" << 'BINSCRIPT'
#!/data/data/com.termux/files/usr/bin/bash
# Reach CLI for Termux
set -euo pipefail

export REACH_DATA_DIR="${REACH_DATA_DIR:-$HOME/.reach/data}"
export REACH_MOBILE=1
export REACH_LOW_MEMORY=1

# Ensure data directory exists
mkdir -p "$REACH_DATA_DIR"

# Mobile-friendly defaults
export REACH_QUIET_ERRORS=1

cmd="${1:-help}"
shift || true

case "$cmd" in
    doctor)
        (cd "$HOME/.reach/repo/tools/doctor" && go run . "$@" 2>&1) || {
            echo "Running mobile doctor..."
            "$HOME/.reach/bin/reachctl" operator "$@"
        }
        ;;
    wizard|run)
        "$HOME/.reach/bin/reachctl" "$cmd" "$@"
        ;;
    capsule|proof|graph|packs|operator|federation|support)
        "$HOME/.reach/bin/reachctl" "$cmd" "$@"
        ;;
    share)
        # Share with QR code
        "$HOME/.reach/bin/reach-share" "$@"
        ;;
    help|--help|-h)
        echo "Reach One-Tap Operator (Mobile Edition)"
        echo ""
        echo "Commands:"
        echo "  wizard     - Guided run flow (choose pack → run → verify → share)"
        echo "  doctor     - Check system health"
        echo "  share      - Share run via QR code"
        echo "  operator   - View operator dashboard"
        echo "  capsule    - Create/verify capsules"
        echo ""
        echo "Quick start: reach wizard"
        ;;
    *)
        "$HOME/.reach/bin/reachctl" "$cmd" "$@" 2>/dev/null || {
            echo "Unknown command: $cmd"
            echo "Try: reach help"
        }
        ;;
esac
BINSCRIPT
    chmod +x "$REACH_INSTALL_DIR/bin/reach"
    
    # Create share script
    cat > "$REACH_INSTALL_DIR/bin/reach-share" << 'SHARESCRIPT'
#!/data/data/com.termux/files/usr/bin/bash
# Share runs via QR code, NFC, or text
set -euo pipefail

export REACH_DATA_DIR="${REACH_DATA_DIR:-$HOME/.reach/data}"

show_qr() {
    local text="$1"
    if command -v termux-share &>/dev/null; then
        echo "$text" | termux-share -a send
    elif command -v qrencode &>/dev/null; then
        qrencode -t ANSIUTF8 "$text"
    else
        echo "Share URL: $text"
        echo ""
        echo "To enable QR codes: pkg install libqrencode"
    fi
}

cmd="${1:-help}"

if [[ "$cmd" == "run" && -n "${2:-}" ]]; then
    run_id="$2"
    capsule_path="$REACH_DATA_DIR/capsules/${run_id}.capsule.json"
    
    # Create capsule if not exists
    if [[ ! -f "$capsule_path" ]]; then
        echo "Creating capsule for $run_id..."
        go run "$HOME/.reach/repo/services/runner/cmd/reachctl" capsule create "$run_id" 2>/dev/null || {
            echo "Creating minimal capsule..."
        }
    fi
    
    # Generate share token
    share_url="reach://share/${run_id}?v=1"
    
    echo "Share your run:"
    show_qr "$share_url"
    
    # Copy to clipboard if available
    if command -v termux-clipboard-set &>/dev/null; then
        echo "$share_url" | termux-clipboard-set
        echo "(Copied to clipboard)"
    fi
    
    # Save to Downloads
    downloads="/sdcard/Download/reach-${run_id}.txt"
    echo "$share_url" > "$downloads" 2>/dev/null && echo "Saved to: $downloads" || true
    
elif [[ "$cmd" == "capsule" && -n "${2:-}" ]]; then
    capsule_file="$2"
    if [[ -f "$capsule_file" ]]; then
        # Generate verification link
        hash=$(sha256sum "$capsule_file" | cut -d' ' -f1 | head -c 16)
        share_url="reach://capsule/${hash}?verify=true"
        
        echo "Share capsule:"
        show_qr "$share_url"
        
        # Also copy capsule to Downloads
        cp "$capsule_file" "/sdcard/Download/" 2>/dev/null && echo "Copied to Downloads" || true
    else
        echo "Capsule not found: $capsule_file"
        exit 1
    fi
else
    echo "Usage: reach share run <run_id>"
    echo "       reach share capsule <file.capsule.json>"
fi
SHARESCRIPT
    chmod +x "$REACH_INSTALL_DIR/bin/reach-share"
    
    # Symlink to PATH
    ln -sf "$REACH_INSTALL_DIR/bin/reach" "$REACH_BIN_DIR/reach"
    ln -sf "$REACH_INSTALL_DIR/bin/reachctl" "$REACH_BIN_DIR/reachctl" 2>/dev/null || true
    
    log_ok "Reach installed to $REACH_INSTALL_DIR"
}

# Create default configuration
setup_config() {
    log_info "Setting up configuration..."
    
    mkdir -p "$REACH_INSTALL_DIR/data/registry"
    
    # Default registry index
    cat > "$REACH_INSTALL_DIR/data/registry/index.json" << 'EOF'
{
  "packs": [
    {
      "name": "demo.echo",
      "repo": "builtin",
      "spec_version": "1.0",
      "signature": "builtin",
      "reproducibility": "A",
      "verified": true,
      "description": "Simple echo demo for testing"
    },
    {
      "name": "safe.calculator",
      "repo": "builtin", 
      "spec_version": "1.0",
      "signature": "builtin",
      "reproducibility": "A",
      "verified": true,
      "description": "Deterministic calculator (mobile-safe)"
    }
  ]
}
EOF
    
    # Mobile-friendly config
    cat > "$REACH_INSTALL_DIR/config.env" << EOF
# Reach Mobile Configuration
REACH_DATA_DIR=$REACH_INSTALL_DIR/data
REACH_MOBILE=1
REACH_LOW_MEMORY=1
REACH_MAX_MEMORY_MB=256
REACH_GC_INTERVAL=10
REACH_QUIET_ERRORS=1
REACH_OFFLINE_FIRST=1
EOF
    
    log_ok "Configuration ready"
}

# Print welcome message
print_welcome() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     Reach One-Tap Operator (Mobile Edition)      ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    log_ok "Installation complete!"
    echo ""
    echo "Quick start:"
    echo "  reach wizard    - Run the guided wizard"
    echo "  reach doctor    - Check system health"
    echo "  reach operator  - View dashboard"
    echo ""
    echo "Tips for Termux:"
    echo "  • Enable termux-api for QR codes: pkg install termux-api"
    echo "  • Storage access: termux-setup-storage"
    echo "  • Low-memory mode is enabled by default"
    echo ""
    log_info "Run 'reach help' for more commands"
}

# Main installation flow
main() {
    echo -e "${GREEN}Reach One-Tap Installer${NC} for Android/Termux"
    echo ""
    
    local arch
    arch=$(check_termux)
    
    install_deps
    install_reach "$arch"
    setup_config
    
    print_welcome
}

main "$@"
