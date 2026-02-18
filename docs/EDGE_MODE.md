# Edge Mode

Edge Mode is Reach's constrained-environment execution profile designed for mobile devices, low-resource environments, and offline operation.

## Overview

When running on resource-constrained devices or without network connectivity, Reach automatically switches to Edge Mode to maintain deterministic execution with reduced resource consumption.

## Activation

### Automatic Detection

Edge Mode activates automatically when:

- Total RAM < 4GB
- Available RAM < 1GB
- CPU count < 2
- Android/Termux environment detected
- No network connectivity
- Explicit `--edge` flag provided

### Manual Activation

```bash
# CLI flag
reach run --edge

# Environment variable
REACH_EDGE_MODE=true reach run

# Config file (~/.reach/config.json)
{
  "edge_mode": {
    "enabled": true,
    "auto_detect": false
  }
}
```

## Behavior Changes

### Model Adaptation

| Feature | Normal Mode | Edge Mode |
|---------|-------------|-----------|
| LLM Backend | Hosted/Local | Deterministic fallback |
| Max Context | 128K+ tokens | 4K tokens |
| Tool Calling | Yes | No |
| Streaming | Yes | No |
| Reasoning | Full | Simplified |

### Execution Constraints

- **Concurrency**: Limited to 2 concurrent runs (vs. 10)
- **Context Compression**: Automatic prompt compression
- **Branching Disabled**: No recursive execution branching
- **Memory Cap**: 512MB default limit
- **Event Streaming**: Memory-efficient replay

### Configuration Overrides

Edge Mode overrides these settings:

```go
MaxConcurrentRuns = 2
MaxContextTokens  = 4096
DisableBranching  = true
SimplifyReasoning = true
MemoryCapMB       = 512
```

## Platform Detection

Reach detects constrained environments via:

```go
platform := model.DetectPlatform()

// Android/Termux
platform.IsAndroid  // true on Android
platform.IsTermux   // true in Termux

// Resource detection
platform.TotalRAM      // Total system RAM
platform.AvailableRAM  // Available RAM
platform.CPUCount      // Number of CPUs
```

## Using Local Models

Even in Edge Mode, you can use local LLMs if available:

```bash
# Start Ollama
ollama serve

# Pull a small model
ollama pull llama3.2:3b

# Reach will auto-detect
reach run --model-mode=local
```

Recommended models for Edge Mode:

| Model | Size | VRAM | Use Case |
|-------|------|------|----------|
| tinyllama:1.1b | 700MB | 1GB | Minimal resource |
| llama3.2:1b | 800MB | 1.5GB | Basic tasks |
| llama3.2:3b | 2GB | 3GB | Balanced |
| phi3:mini | 2GB | 3GB | Good reasoning |

## Android Setup

See [ANDROID_SETUP.md](./ANDROID_SETUP.md) for Termux installation.

Quick start:

```bash
# In Termux
pkg install golang
pkg install ollama

# Start Ollama
ollama serve &

# Run Reach in edge mode
reach run --edge
```

## Performance Characteristics

### Memory Usage

| Component | Normal | Edge |
|-----------|--------|------|
| Base Runtime | 50MB | 30MB |
| Event Buffer | 100MB | 10MB |
| Model (hosted) | 0MB | 0MB |
| Model (local) | 4000MB | 2000MB |

### Latency

| Operation | Normal | Edge |
|-----------|--------|------|
| Policy Check | 5ms | 5ms |
| Small Model | 2000ms | 500ms |
| Fallback | N/A | 10ms |
| Replay | 100ms | 50ms |

## Determinism Guarantees

Edge Mode maintains the same determinism guarantees as Normal Mode:

- Event ordering is preserved
- Policy enforcement unchanged
- Replay verification works identically
- Signing and verification unchanged

Only the model capability is reduced, not execution integrity.

## CLI Commands

```bash
# Check if edge mode would activate
reach doctor --check-edge

# Force edge mode
reach run --edge

# Check current mode
reach config get edge_mode.enabled

# Set persistent edge mode
reach config set edge_mode.enabled true
```

## Troubleshooting

### Edge Mode Activates Unexpectedly

Check resource detection:

```bash
reach doctor --verbose
```

Look for:
- Available RAM detection
- Android platform flag
- Model availability

### Local Model Not Detected

Verify Ollama is running:

```bash
curl http://localhost:11434/api/tags
```

### Out of Memory

Reduce context window:

```json
{
  "edge_mode": {
    "max_context_tokens": 2048,
    "memory_cap_mb": 256
  }
}
```

## Migration from Normal Mode

Code running in Normal Mode works in Edge Mode without changes. However:

- Complex reasoning tasks may fail gracefully
- Tool calls will return "not available" errors
- Large context windows will be truncated

Design packs to work within Edge Mode constraints for maximum portability.
