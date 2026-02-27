# Content-Addressable Storage (CAS)

> **Status:** Implemented  
> **Last Updated:** 2026-02-27

## Overview

The Reach Content-Addressable Storage (CAS) provides immutable, content-addressed storage for run artifacts, transcripts, and proofs. Local CAS defaults to `~/.reach/cas`.

## Object Types

| Type | Description | Use Case |
|------|-------------|-----------|
| `transcript` | Execution transcript data | Replay verification |
| `canonical-bytes` | Canonical memory payloads | Deterministic hashing |
| `bundle-manifest` | Pack/bundle manifests | Pack verification |
| `step-proof` | Individual step proofs | Evidence chain |

## Implementation

Located in `services/runner/internal/trust/cas.go`.

### Storage Model

- **Addressing**: Objects are addressed by SHA-256 of the original bytes
- **Verification**: On read, CAS verifies:
  1. Stored blob hash matches expected key
  2. Decompressed content BLAKE3 hash equals CAS key
- **Atomic writes**: Enabled by default (temp file + rename)
- **Symlink protection**: CAS rejects symlinks in object paths

### Configuration

```go
type CASConfig struct {
    MaxCASSizeBytes     int64   // Max size (default: 10GB, 0=unlimited)
    EvictionPolicy      string  // "none", "lru", or "size-cap"
    LRUWindow           string  // Time window for LRU (e.g., "24h", "7d")
    AtomicWritesEnabled bool    // Atomic write mode (default: true)
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REACH_CAS_MAX_SIZE_BYTES` | 10737418240 | Max CAS size (10GB) |
| `REACH_CAS_EVICTION_POLICY` | none | Eviction: none/lru/size-cap |
| `REACH_CAS_LRU_WINDOW` | 24h | LRU retention window |
| `REACH_CAS_ATOMIC_WRITES` | true | Enable atomic writes |

## Eviction Policies

### None (Default)

No automatic eviction. CAS grows until manually cleaned.

### LRU (Least Recently Used)

Evicts objects outside the configured LRU window:
- `LRUWindow` defines retention period (default: 24h)
- Access time tracked on every read
- Objects not accessed within window are candidates for eviction

### Size-Cap

Enforces maximum CAS size:
- When total size exceeds `MaxCASSizeBytes`, evicts LRU objects
- Continues evicting until under limit

## Compaction

The `Compact(aggressive bool)` function removes malformed or corrupted objects:

- **Standard mode**: Removes objects with invalid content hashes
- **Aggressive mode**: Full reorganization, may recover additional space

GC removes orphaned objects not referenced by any manifest.

## CLI Commands

```bash
# View CAS status
reach cache status

# Run garbage collection
reach cache gc

# Run compaction (aggressive)
reach cache gc --aggressive
```

## Performance Characteristics

- **Hit rate**: Tracked in PPM (parts per million)
- **Metrics**: Available via `reachctl metrics` under `cas_hit_rate_ppm`
- **Load testing**: 10,000 insert/read cycles verified in tests without fragmentation

## Security

- TOCTOU-safe file operations
- Path traversal protection
- Symlink rejection in CAS directories
- Integrity verification on every read

## Known Limitations

1. **No automatic size-based eviction by default** - Must explicitly configure eviction policy
2. **LRU tracking adds overhead** - Only enabled when LRU eviction policy is set
3. **Aggressive compaction is slower** - Should be run during maintenance windows
