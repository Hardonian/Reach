# Android Setup Guide Reach runs on Android via Termux, enabling on-device execution packs and edge-first AI workflows.

## Prerequisites - Android 8.0+ (API 26+)
- 2GB+ free storage
- 4GB+ RAM recommended

## Installation ### Step 1: Install Termux

Download Termux from F-Droid (recommended) or GitHub:

```bash
# F-Droid (preferred) https://f-droid.org/packages/com.termux/

# GitHub releases https://github.com/termux/termux-app/releases
```

> **Note**: Do not use the Play Store version - it's outdated and unsupported.

### Step 2: Bootstrap Script Run the one-command installer:

```bash
# Download and run bootstrap curl -fsSL https://get.reach.dev/android-bootstrap.sh | bash
```

Or manually:

```bash
# Update packages pkg update && pkg upgrade -y

# Install dependencies pkg install -y golang git nodejs ollama

# Install Reach go install github.com/reach/reach/services/runner/cmd/reachctl@latest

# Create config directory mkdir -p ~/.reach
```

### Step 3: Start Ollama (Optional) For local LLM support:

```bash
# Download a small model ollama pull llama3.2:3b

# Start server ollama serve &
```

### Step 4: Verify Installation ```bash
reach doctor
```

Expected output:
```
✓ Reach CLI installed
✓ Determinism engine available
✓ Config directory exists
✓ Edge mode: auto-detected
⚠ Ollama not running (optional)
```

## File System Constraints ### Storage Locations

| Path | Purpose | Notes |
|------|---------|-------|
| `/data/data/com.termux/files/home/.reach` | Config | Persistent |
| `/data/data/com.termux/files/usr/tmp` | Temp | Cleared on reboot |
| `/sdcard/Download/reach` | Shared storage | Accessible to other apps |
| Termux internal | Cache | Private to Termux |

### Android Permissions Termux doesn't require special permissions for:
- Local file access (internal storage)
- Network connections
- Background execution

For external storage:

```bash
termux-setup-storage
```

## Performance Tuning ### Memory Management

Android apps have memory limits. Reach auto-configures for constrained environments:

```bash
# Check auto-detected limits reach config get edge_mode

# Manual override reach config set edge_mode.memory_cap_mb 256
reach config set edge_mode.max_context_tokens 2048
```

### Battery Optimization Disable battery optimization for Termux:

1. Settings → Apps → Termux → Battery
2. Set to "Unrestricted" or "Don't optimize"

### Background Execution Keep Reach running:

```bash
# Using termux-wake-lock termux-wake-lock

# Run your pack reach run --edge ./my-pack.tar.gz

# Release wake lock termux-wake-unlock
```

## PWA Strategy For a web-based interface on Android:

### Option 1: Termux + Web Server ```bash
# In Termux, start Reach server reach serve --addr :8080 &

# Open browser to http://localhost:8080 ```

### Option 2: PWA Wrapper Create a simple PWA:

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reach Mobile</title>
    <script>
        // Connect to local Reach instance
        const API = 'http://localhost:8080';

        async function runPack() {
            const response = await fetch(`${API}/api/v1/run`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({pack: 'hello-world'})
            });
            return response.json();
        }
    </script>
</head>
<body>
    <h1>Reach Mobile</h1>
    <button onclick="runPack()">Run Pack</button>
</body>
</html>
```

Serve with any static file server:

```bash
python3 -m http.server 8000
```

### Add to Home Screen 1. Open in Chrome
2. Menu → "Add to Home screen"
3. Launch as standalone app

## React Native Wrapper (Future) A minimal React Native wrapper is planned:

```javascript
// reach-rn-bridge
import {NativeModules} from 'react-native';

const {ReachModule} = NativeModules;

export async function runPack(packPath, options) {
  return ReachModule.runPack(packPath, {
    edgeMode: true,
    ...options
  });
}
```

For now, use the PWA approach or Termux directly.

## Common Issues ### "Permission Denied" Errors

```bash
# Fix Termux permissions termux-fix-shebang $(which reach)

# Or reinstall pkg reinstall reach
```

### Out of Memory ```bash
# Reduce memory limits export REACH_EDGE_MEMORY_CAP_MB=256
export REACH_EDGE_MAX_CONTEXT=2048

# Kill background processes pkill -f ollama
```

### Network Unavailable ```bash
# Check network ping google.com

# Reset Termux network termux-wifi-enable true
```

### Slow Performance ```bash
# Use smaller model ollama pull tinyllama:1.1b

# Disable metrics reach config set telemetry.metrics_enabled false
```

## Development Workflow ### Developing on Android

```bash
# Create pack directory mkdir -p ~/reach-packs/my-pack
cd ~/reach-packs/my-pack

# Edit files (using nano/vim) nano reach.yaml

# Pack and test reach pack . && reach run --edge ./my-pack.tar.gz
```

### Sync from Desktop ```bash
# Using rsync over SSH rsync -avz ~/reach-packs/ phone:/data/data/com.termux/files/home/reach-packs/

# Or using ADB adb push ~/reach-packs/ /sdcard/Download/reach/
```

## Debugging ### View Logs

```bash
# Termux session tail -f ~/.reach/logs/reach.log

# With logcat logcat -s "Reach:*"
```

### Check Resource Usage ```bash
# Memory top -p $(pgrep reach)

# Disk usage du -sh ~/.reach/

# Network netstat -tlnp | grep reach
```

## Security Considerations ### Sandboxing

Reach's sandbox is limited on Android:
- No chroot (requires root)
- No user namespaces
- Relies on Termux isolation

Policy enforcement still works:
- Tool allow/deny lists
- Network access controls
- File system restrictions

### Key Storage Private keys are stored in:
```
/data/data/com.termux/files/home/.reach/keys/
```

This location is:
- Protected by Android app sandbox
- Encrypted at rest (Android 10+)
- Not accessible to other apps

## Uninstallation ```bash
# Remove Reach go clean -i github.com/reach/reach/...

# Remove config rm -rf ~/.reach

# Remove Termux data (DANGER: deletes everything) rm -rf /data/data/com.termux
```

## Further Reading - [Edge Mode](./EDGE_MODE.md)
- [Termux Wiki](https://wiki.termux.com/)
- [Ollama on Mobile](https://github.com/ollama/ollama/blob/main/docs/android.md)
