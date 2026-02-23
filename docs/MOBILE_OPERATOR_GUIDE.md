# Reach Mobile Operator Guide One-tap execution for Android/Termux. Run → Verify → Share in 3 steps.

## Quick Start (Termux) ```bash

# One-line installer curl -fsSL https://get.reach.dev/termux | bash

# Or with wget wget -qO- https://get.reach.dev/termux | bash

````

## First Run ```bash
# Check system health reach doctor

# Run the guided wizard reach wizard

# View your dashboard reach operator
````

## Core Commands | Command | Purpose | Mobile-Optimized |

|---------|---------|------------------|
| `reach wizard` | Guided pack selection and execution | ✓ Yes |
| `reach doctor` | Health check with mobile-specific tips | ✓ Yes |
| `reach run <pack>` | Quick run a specific pack | ✓ Yes |
| `reach share run <id>` | Share via QR code | ✓ Yes |
| `reach operator` | Dashboard with key metrics | ✓ Yes |

## The 3-Step Flow ### Step 1: Choose & Run

````bash
reach wizard
# 1. Select pack from list # 2. Confirm safe defaults
# 3. Execute (run ID generated) ```

### Step 2: Verify ```bash
reach proof verify <run-id>
# Shows: fingerprint, audit root, determinism check ```

### Step 3: Share ```bash
reach share run <run-id>
# Shows: QR code, share URL, saves to Downloads ```

## Safe Defaults (Non-Negotiable) Mobile mode automatically enables:

| Setting | Default | Why |
|---------|---------|-----|
| `REACH_LOW_MEMORY=1` | Enabled | Prevents OOM on 2-4GB devices |
| `REACH_MAX_MEMORY_MB` | 256 | Conservative memory ceiling |
| `REACH_OFFLINE_FIRST=1` | Enabled | No unexpected data charges |
| `REACH_QUIET_ERRORS=1` | Enabled | Clear, actionable error messages |
| Determinism checks | Enabled | Replay integrity maintained |
| Policy gates | Enabled | No capability bypass |

## Low-Memory Mode When `REACH_LOW_MEMORY=1`:

- GC runs every 10 seconds (vs. default 60)
- Max concurrent runs: 1
- Event log buffering: limited to 1000 events
- Automatic capsule cleanup after 7 days

## QR Code Sharing Requires `termux-api`:

```bash
pkg install termux-api
reach share run <run-id>
# Generates QR code for easy device-to-device sharing ```

Without termux-api, shares as text URL.

## Accessibility Features - **Clear language**: No technical jargon in wizard
- **Status emojis**: ✓ ✗ ⚠ for quick scanning
- **Box drawing**: Visual separation in dashboard
- **Safe confirmations**: Critical actions require explicit confirm
- **Progress indication**: Step X/Y shown throughout wizard

## Storage Locations | Content | Path | Exportable |
|---------|------|------------|
| Runs | `~/.reach/data/runs/` | Yes |
| Capsules | `~/.reach/data/capsules/` | Yes |
| Registry | `~/.reach/data/registry/` | No |
| Shared files | `/sdcard/Download/reach-*` | Auto-exported |

## Troubleshooting ### "Cannot write to data directory"
```bash
# Fix permissions mkdir -p ~/.reach/data
chmod 755 ~/.reach
````

### "Out of memory" ```bash

# Reduce memory limit export REACH_MAX_MEMORY_MB=128

reach wizard

````

### "QR code not showing" ```bash
# Install qrencode pkg install libqrencode
# Or use termux-api pkg install termux-api
````

### "Run fails immediately" ```bash

# Check doctor reach doctor --json

# Verify Go runtime pkg install golang

````

## Privacy & Security - **Offline-first**: No network required for core operations
- **Local-only**: Data stays on device unless explicitly shared
- **Deterministic**: Same inputs always produce same outputs
- **Signed capsules**: Tamper-evident sharing format
- **No secrets in logs**: Policy engine redacts sensitive data

## Limitations vs Desktop | Feature | Mobile | Desktop |
|---------|--------|---------|
| Concurrent runs | 1 | Unlimited |
| Max event log | 10K entries | 1M entries |
| Pack complexity | Simple-Medium | All |
| Federation | Read-only | Full |

## Getting Help ```bash
# In-app help reach help

# Support bot reach support ask "how do I share a run?"

# Check logs ls ~/.reach/data/runs/
````

## Upgrade ```bash

cd ~/.reach/repo && git pull

# Or re-run installer curl -fsSL https://get.reach.dev/termux | bash

```

```
