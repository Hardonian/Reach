# Why Requiem Replaces the Rust Engine

> **Version:** 1.2
> **Last Updated:** 2026-02-27

This document explains why Reach has moved from the Rust engine to Requiem (C++). This is factual, not aspirational.

---

## What Requiem Guarantees

### Determinism

**Claim:** Identical inputs produce identical fingerprints across platforms.

**Evidence:**
- Fixed-point math only (Q32.32, BPS, PPM, Duration, Throughput)
- Canonical CBOR encoding with sorted map keys
- No floating-point in fingerprint-contributing paths
- BLAKE3 hashing (not SHA-256)

**Verification:**
```bash
reach verify:determinism --runs=10
```

This passes in CI and locally with the same inputs.

---

### Hashing

**Claim:** BLAKE3 is used for all fingerprint and integrity hashing.

**Evidence:**
- BLAKE3 used for run fingerprints
- BLAKE3 used for CAS content addressing
- BLAKE3 used for plugin result verification

**Not guaranteed:** SHA-256 compatibility. Legacy SHA-256 hashes are not produced.

---

### Protocol

**Claim:** Streaming binary protocol with version negotiation.

**Evidence:**
- Protocol v1.0 implemented with CBOR encoding
- Version negotiation via Hello/HelloAck handshake
- CRC32C integrity on all frames
- Automatic resynchronization on parse errors

**Not guaranteed:** Protocol backward compatibility beyond v1.0.

---

## What Requiem Does NOT Guarantee

### Sandbox Isolation

**Claim:** Reach is NOT a strong sandbox.

**Evidence:**
- Packs with file capability can access filesystem (within workspace)
- Packs with network capability can make outbound connections
- No process isolation beyond OS-level limits
- Policy rules execute with full system access

**Implication:** Do not run untrusted packs without reviewing policy rules.

---

### Capability Truth

**Claim:** Capability declarations are not enforced as sandbox rules.

**Evidence:**
- Packs declare capabilities (file, network, exec)
- These are used for policy decisions, not engine enforcement
- Engine does not block file access if policy allows

**Implication:** Review pack policies before running.

---

### Data at Rest Encryption

**Claim:** CAS and transcripts are not encrypted at rest.

**Evidence:**
- CAS stores raw blobs (addressed by BLAKE3)
- Transcripts stored as CBOR files
- No default encryption enabled

**Implication:** Enable encryption at storage layer if required.

---

## Performance Characteristics

### What We Measure

- **Throughput:** ~1000 runs/second (single instance)
- **Latency:** <50ms median for simple policies
- **Memory:** 4GB default limit, 1M matrix cell max

### What We Don't Claim

- Performance is better than Rust engine (not measured)
- Performance is optimal for all workloads (not tuned)
- Performance scales linearly (depends on workload)

---

## Migration Notes

### From Rust Engine

If you were using the Rust engine:

1. **Environment variable changed:**
   - Old: `REACH_ENGINE=rust`
   - New: Use Requiem (default) or `FORCE_RUST=1`

2. **Protocol unchanged:**
   - Same message format
   - Same version negotiation
   - Same CBOR encoding

3. **Determinism preserved:**
   - Same guarantees
   - Same fixed-point types
   - Same BLAKE3 hashing

### Rollback

To rollback to Rust engine:

```bash
FORCE_RUST=1 reach run my-pack
```

**Warning:** Determinism may differ between engines. Re-verify with `reach verify:determinism`.

---

## Falsifiability

These claims can be tested:

| Claim | Test |
|-------|------|
| Identical inputs → Identical fingerprints | Run same pack 10x, compare fingerprints |
| Fixed-point math | Check source for floating-point in fingerprint paths |
| BLAKE3 hashing | Inspect hashing calls, verify BLAKE3 usage |
| No sandbox | Run pack with file access, observe filesystem access |
| No encryption | Inspect CAS storage, verify plaintext blobs |

---

## Summary

| Guaranteed | NOT Guaranteed |
|------------|----------------|
| Determinism (fixed-point + BLAKE3) | Sandbox isolation |
| Protocol v1.0 | Capability enforcement |
| Replay verification | Encryption at rest |
| CAS integrity | Performance characteristics |

This is the current state. These guarantees may change in future versions with explicit notice.
