#!/bin/bash
# Reach Android Bootstrap Script for Termux
# One-command installation for Termux/Reach on Android

set -e

REPO_URL="https://github.com/reach/reach"
INSTALL_DIR="$HOME/.reach"
CONFIG_DIR="$HOME/.reach"

echo "=== Reach Android Bootstrap ==="
echo ""

# Check if running in Termux
if [ -z "$TERMUX_VERSION" ]; then
    echo "⚠ Warning: Not running in Termux. This script is designed for Termux on Android."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update package lists
echo "📦 Updating package lists..."
apt-get update -qq

# Install required packages
echo "📦 Installing dependencies..."
pkg install -y -qq golang git nodejs 2>/dev/null || apt-get install -y golang git nodejs

# Optional: Install Ollama if not present
if ! command -v ollama &> /dev/null; then
    echo "📦 Installing Ollama (optional)..."
    curl -fsSL https://ollama.com/install.sh | sh 2>/dev/null || {
        echo "⚠ Ollama installation skipped (manual install may be required)"
    }
fi

# Create directories
echo "📁 Creating directories..."
mkdir -p "$CONFIG_DIR"
mkdir -p "$CONFIG_DIR/logs"
mkdir -p "$CONFIG_DIR/keys"
mkdir -p "$CONFIG_DIR/packs"
mkdir -p "$CONFIG_DIR/profile"

# Install Reach from source
echo "🔧 Building Reach..."
if [ -d "$HOME/go/src/github.com/reach/reach" ]; then
    cd "$HOME/go/src/github.com/reach/reach"
    git pull
else
    mkdir -p "$HOME/go/src/github.com/reach"
    cd "$HOME/go/src/github.com/reach"
    git clone "$REPO_URL" 2>/dev/null || echo "⚠ Clone failed, using go install..."
fi

# Build and install
cd "$HOME/go/src/github.com/reach/reach/services/runner" 2>/dev/null || {
    echo "📥 Installing via go install..."
    go install github.com/reach/reach/services/runner/cmd/reachctl@latest 2>/dev/null || {
        echo "⚠ Go install failed, using fallback method"
        mkdir -p "$HOME/go/bin"
        cat > "$HOME/go/bin/reach" << 'EOF'
#!/bin/bash
# Fallback reach script
echo "Reach is not fully installed."
echo "Please run: cd services/runner && go build -o ~/go/bin/reachctl ./cmd/reachctl"
exit 1
EOF
        chmod +x "$HOME/go/bin/reach"
    }
}

# Ensure PATH includes go/bin
if [[ ":$PATH:" != *":$HOME/go/bin:"* ]]; then
    echo 'export PATH="$PATH:$HOME/go/bin"' >> "$HOME/.bashrc"
    export PATH="$PATH:$HOME/go/bin"
fi

# Create default config with edge mode optimized for Android
echo "⚙️  Creating default configuration..."
cat > "$CONFIG_DIR/config.json" << 'EOF'
{
  "execution": {
    "max_concurrent_runs": 2,
    "max_event_bytes": 10485760,
    "event_log_mode": "warn",
    "sandbox_enabled": true,
    "streaming_replay": true,
    "max_event_buffer_size": 1048576
  },
  "edge_mode": {
    "enabled": false,
    "auto_detect": true,
    "max_context_tokens": 4096,
    "disable_branching": true,
    "simplify_reasoning": true,
    "max_concurrent_runs": 2,
    "memory_cap_mb": 512
  },
  "model": {
    "mode": "auto",
    "local_endpoint": "http://localhost:11434"
  },
  "telemetry": {
    "log_level": "info",
    "metrics_enabled": false,
    "tracing_enabled": false
  },
  "determinism": {
    "strict_mode": false,
    "verify_on_load": true,
    "canonical_time_format": true
  }
}
EOF

# Create profile directory for gamification
touch "$CONFIG_DIR/profile/achievements.json"
echo '{"unlocked":[],"stats":{"runs":0,"verified":0}}' > "$CONFIG_DIR/profile/achievements.json"

# Make reach accessible
echo "🔗 Setting up reach command..."
if [ -f "$HOME/go/bin/reachctl" ]; then
    ln -sf "$HOME/go/bin/reachctl" "$HOME/go/bin/reach" 2>/dev/null || true
fi

# Detect platform and set up
echo "🔍 Detecting platform..."
RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")
RAM_MB=$((RAM_KB / 1024))
echo "   Detected RAM: ${RAM_MB}MB"

if [ "$RAM_MB" -lt 4096 ]; then
    echo "   Low memory detected - optimizing for constrained environment"
    # Adjust config for low memory
    cat > "$CONFIG_DIR/config.json" << EOF
{
  "execution": {
    "max_concurrent_runs": 1,
    "max_event_bytes": 5242880,
    "event_log_mode": "warn",
    "sandbox_enabled": true,
    "streaming_replay": true,
    "max_event_buffer_size": 524288
  },
  "edge_mode": {
    "enabled": true,
    "auto_detect": false,
    "max_context_tokens": 2048,
    "disable_branching": true,
    "simplify_reasoning": true,
    "max_concurrent_runs": 1,
    "memory_cap_mb": 256
  },
  "model": {
    "mode": "edge"
  },
  "telemetry": {
    "log_level": "warn",
    "metrics_enabled": false,
    "tracing_enabled": false
  },
  "determinism": {
    "strict_mode": false,
    "verify_on_load": true,
    "canonical_time_format": true
  }
}
EOF
fi

# Add helpful aliases
echo "" >> "$HOME/.bashrc"
echo "# Reach aliases" >> "$HOME/.bashrc"
echo 'alias reach-doctor="reach doctor"' >> "$HOME/.bashrc"
echo 'alias reach-edge="reach run --edge"' >> "$HOME/.bashrc"

# Create helper script
cat > "$HOME/go/bin/reach-android-helper" << 'EOF'
#!/bin/bash
# Helper script for Android/Termux specific operations

case "$1" in
    setup-storage)
        termux-setup-storage
        ;;
    start-ollama)
        echo "Starting Ollama..."
        ollama serve &
        sleep 2
        echo "Ollama started on http://localhost:11434"
        ;;
    stop-ollama)
        pkill -f "ollama serve" || echo "Ollama not running"
        ;;
    status)
        echo "=== Reach Android Status ==="
        echo "Reach CLI: $(which reachctl 2>/dev/null || echo 'not found')"
        echo "Config dir: $HOME/.reach"
        echo "Ollama: $(pgrep -f "ollama serve" > /dev/null && echo 'running' || echo 'not running')"
        echo "Edge mode: $(grep -o '"enabled": true' $HOME/.reach/config.json 2>/dev/null && echo 'enabled' || echo 'auto')"
        echo "RAM: $(grep MemTotal /proc/meminfo | awk '{print $2}') KB"
        ;;
    cleanup)
        echo "Cleaning up Reach temp files..."
        rm -rf "$HOME/.reach/tmp"/*
        rm -rf "$HOME/.reach/logs"/*.old
        echo "Done"
        ;;
    *)
        echo "Usage: reach-android-helper {setup-storage|start-ollama|stop-ollama|status|cleanup}"
        ;;
esac
EOF
chmod +x "$HOME/go/bin/reach-android-helper"

echo ""
echo "✅ Reach Android installation complete!"
echo ""
echo "Next steps:"
echo "  1. Restart Termux or run: source ~/.bashrc"
echo "  2. Verify: reach doctor"
echo "  3. Run: reach run --edge"
echo ""
echo "Optional:"
echo "  - Start Ollama: reach-android-helper start-ollama"
echo "  - Pull a model: ollama pull llama3.2:3b"
echo "  - Check status: reach-android-helper status"
echo ""
echo "For help: reach --help"
echo "Edge mode docs: https://docs.reach.dev/edge-mode"
