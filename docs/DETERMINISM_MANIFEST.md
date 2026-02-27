# Determinism Manifest V1

**Version:** 1.0.0  
**Effective Date:** 2026-02-26  
**Status:** FROZEN  
**Authority:** Reach Core Engineering  

---

## 1. Manifest Purpose

This document is the **single source of truth** for deterministic execution guarantees in Reach. It defines the mathematical boundary between deterministic and non-deterministic code paths.

> **Core Invariant:** Given identical inputs, policies, and artifacts, every execution MUST produce byte-identical outputs and the same SHA-256 fingerprint, on any machine, at any time.

---

## 2. Version History

| Version | Date | Change | Migration Required |
|---------|------|--------|-------------------|
| 1.0.0 | 2026-02-26 | Initial frozen manifest | None |

---

## 3. Fingerprint Boundary Specification

### 3.1 Canonical Run Model

The fingerprint is derived from this canonical model (fields in strict order):

```json
{
  "run_id":          "<sha256-derived-from-pack-hash + input-hash + sequence>",
  "engine_version":  "<semver, pinned>",
  "policy_version":  "<sha256 of policy bundle>",
  "input_hash":      "<sha256 of canonical-JSON of inputs>",
  "artifact_hashes": ["<sha256 sorted by artifact ID>"],
  "output_hash":     "<sha256 of canonical-JSON of outputs>",
  "event_log_hash":  "<sha256 of NDJSON event log, insertion order>",
  "timestamp_epoch": 0,
  "fingerprint":     "<sha256(run_id + engine_version + event_log_hash)>"
}
```

### 3.2 Digest Authority Chain

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 0: Raw Inputs                                         │
│  - Pack manifest                                             │
│  - Input values (canonicalized)                              │
│  - Policy bundle                                             │
└───────────────────────┬─────────────────────────────────────┘
                        │ SHA-256
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: Content Hashes                                     │
│  - input_hash                                                │
│  - policy_version                                            │
│  - artifact_hashes[]                                         │
└───────────────────────┬─────────────────────────────────────┘
                        │ Canonical JSON + SHA-256
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: Run Identity                                       │
│  - run_id = SHA256(pack_hash + input_hash + sequence)       │
└───────────────────────┬─────────────────────────────────────┘
                        │ Execution
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: Event Log (Deterministic Order)                   │
│  - NDJSON events in strict insertion order                  │
│  - No timestamps in fingerprint path                        │
└───────────────────────┬─────────────────────────────────────┘
                        │ SHA-256
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: Final Fingerprint                                  │
│  - SHA256(run_id + engine_version + event_log_hash)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Entropy Exclusion Zones

The following MUST NOT affect the fingerprint:

| Category | Examples | Enforcement |
|----------|----------|-------------|
| **Timing** | `time.Now()`, wall-clock timestamps, durations | CI Gate `verify:determinism` |
| **Randomness** | `rand()`, `uuid.New()`, crypto/rand | Static analysis + runtime check |
| **Environment** | `os.Getenv()`, hostname, PID (except seeded) | Import boundary validation |
| **Platform** | Pointer values, memory addresses, file paths | Canonicalization layer |
| **Ordering** | Map iteration order, goroutine scheduling | Sort all keys before hash |
| **Transport** | Network latency, retry counts, timeouts | Isolation layer |
| **Logging** | Log levels, verbosity, output format | Side-channel only |
| **Metrics** | Counters, gauges, timers | Side-channel only |

---

## 5. Serialization Contract

### 5.1 Canonical JSON Rules

1. **Key Ordering:** Lexicographic (UTF-8 byte order)
2. **Whitespace:** None (compact encoding)
3. **Numbers:** 
   - Integers: Standard decimal
   - Floats: **FORBIDDEN** in fingerprint paths (use fixed-point integers)
4. **Null:** Explicit `null` for absent fields
5. **Arrays:** Preserved order (caller must stabilize)

### 5.2 Reference Implementation

```go
// services/runner/internal/determinism/determinism.go
func Hash(v any) string {
    // Pooled buffer + hasher for zero-allocation hot path
    bw := bufferPool.Get().(*bufferWrapper)
    defer bufferPool.Put(bw)
    bw.buf = bw.buf[:0]

    h := hasherPool.Get().(hash.Hash)
    defer hasherPool.Put(h)
    h.Reset()

    canonicalizeToHasher(v, h)
    sum := h.Sum(bw.buf[:0])
    return hex.EncodeToString(sum)
}
```

---

## 6. Memory Topology Guarantees

### 6.1 Deterministic Heap Layout

| Component | Guarantee | Verification |
|-----------|-----------|------------|
| String interning | Content-addressed | `string_intern_test.go` |
| Map ordering | Keys sorted before iteration | Static analysis |
| Slice capacity | Not included in hash | Canonicalization |
| Pointer values | Never hashed | Lint rule |

### 6.2 Zero-Copy Boundary

```rust
// crates/engine-core/src/digest.rs
pub fn compute_fingerprint(
    run_id: &[u8; 32],
    engine_version: &str,
    event_log: &[Event],
) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(run_id);
    hasher.update(engine_version.as_bytes());
    
    // Events streamed directly to hasher (no intermediate buffer)
    for event in event_log {
        event.canonicalize_to(&mut hasher);
    }
    
    hasher.finalize().into()
}
```

---

## 7. Transport/Logging/Metrics Isolation Proof

### 7.1 Transport Layer Isolation

```
┌─────────────────────────────────────────────────────────────┐
│  Transport Layer (Non-Deterministic)                        │
│  - HTTP/gRPC headers                                        │
│  - Network retries                                          │
│  - Timeouts                                                 │
└───────────────────────┬─────────────────────────────────────┘
                        │ Wall-clock timing only
                        │ NEVER flows to fingerprint
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Protocol Boundary                                          │
│  - Request/Response marshaling                              │
│  - Error classification                                     │
└───────────────────────┬─────────────────────────────────────┘
                        │ Deterministic payload only
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Engine Core (Deterministic)                                │
│  - Execution logic                                          │
│  - Event generation                                         │
│  - Fingerprint computation                                  │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Logging Isolation Proof

Log entries are **side-channel only**:

```go
// Log output (non-deterministic, human-readable)
log.Info("tool executed", 
    "tool", toolName,           // OK: metadata
    "duration", time.Since(t),  // OK: wall-clock only
    "step_id", stepID)          // OK: deterministic ID

// NEVER: log output does NOT feed into fingerprint
```

### 7.3 Metrics Isolation Proof

Metrics are **never read** during execution:

```go
// metrics.go - Write-only from engine perspective
func (m *Metrics) Counter(name string) {
    atomic.AddInt64(counter, 1)
    m.writeSink(name, TypeCounter, value)  // Fire-and-forget
}

// Engine NEVER calls:
// - metrics.GetCounter()
// - metrics.Snapshot()
// - metrics.Dump()
```

---

## 8. API Stability Guarantees

### 8.1 Frozen Interfaces

| Interface | Status | Stability |
|-----------|--------|-----------|
| `determinism.Hash()` | FROZEN | v1.0.0+ |
| `determinism.CanonicalJSON()` | FROZEN | v1.0.0+ |
| `determinism.VerifyReplay()` | FROZEN | v1.0.0+ |
| `pack.ComputeIntegrity()` | FROZEN | v1.0.0+ |
| `pack.VerifyProof()` | FROZEN | v1.0.0+ |

### 8.2 Breaking Change Policy

Any change to the fingerprint algorithm requires:
1. New manifest version (e.g., v2.0.0)
2. Migration period (minimum 2 minor versions)
3. Replay compatibility shim
4. Announcement in CHANGELOG.md

---

## 9. Verification Checklist

```bash
# 1. Run the determinism conformance suite
reachctl verify-determinism --n=5

# 2. Verify boundary integrity
cargo test -p engine-core -- invariants
go test ./services/runner/internal/determinism/...

# 3. Check entropy exclusion
npm run validate:oss-purity
npm run validate:boundaries

# 4. Verify golden fixtures
reachctl self-test --n=200
```

---

## 10. Compliance

Systems claiming Reach compatibility MUST:

1. Produce identical fingerprints for identical inputs
2. Pass the conformance test suite
3. Not import forbidden entropy sources in hash paths
4. Follow the canonical JSON serialization rules

Non-compliance is a **critical bug** with immediate rollback priority.

---

**Manifest Signature:** `sha256(DETERMINISM_MANIFEST.md v1.0.0)` = `TBD`  
**Last Updated:** 2026-02-26  
**Next Review:** On breaking change proposal only
