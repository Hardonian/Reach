# Invariant Authority Map

**Version:** 1.0.0  
**Purpose:** Single source of truth for where each invariant is enforced

---

## 1. Authority Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: Mathematical (Axiomatic)                           │
│  Cannot be violated by correct implementation                │
│  Authority: Formal specification                             │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 2: Implementation (Code)                              │
│  Enforced by a specific code location                       │
│  Authority: Single function/method                           │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 3: Runtime (Dynamic)                                  │
│  Verified during execution                                  │
│  Authority: Assertions + replay tests                        │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 4: Static (Compile-time)                              │
│  Enforced before execution                                  │
│  Authority: Type system + linters                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Invariant Registry

### 2.1 Determinism Invariants

| ID | Invariant | Tier | Authority | Location |
|----|-----------|------|-----------|----------|
| DET-001 | Same inputs → same fingerprint | T2 | `determinism.Hash()` | `services/runner/internal/determinism/determinism.go:60` |
| DET-002 | Canonical JSON keys sorted | T2 | `canonicalize()` | `services/runner/internal/determinism/determinism.go:91` |
| DET-003 | No wall-clock time in hash path | T3 | `verify-determinism` | `scripts/verify-determinism.ts` |
| DET-004 | No randomness in hash path | T4 | `validate:oss-purity` | `scripts/validate-oss-purity.ts` |
| DET-005 | Floats excluded from fingerprint | T2 | `canonicalizeToHasher()` | `services/runner/internal/determinism/determinism.go:124` |
| DET-006 | Map iteration sorted before hash | T2 | `canonicalize()` | `services/runner/internal/determinism/determinism.go:99` |

### 2.2 Integrity Invariants

| ID | Invariant | Tier | Authority | Location |
|----|-----------|------|-----------|----------|
| INT-001 | Pack content-addressed | T2 | `ComputePackIntegrity()` | `services/runner/internal/pack/merkle.go:318` |
| INT-002 | Merkle root binds all leaves | T1 | Merkle tree math | `services/runner/internal/pack/merkle.go:92` |
| INT-003 | Proofs verify against root | T2 | `VerifyProof()` | `services/runner/internal/pack/merkle.go:232` |
| INT-004 | Artifact hashes immutable | T3 | Replay verification | `services/runner/internal/determinism/verify.go` |

### 2.3 Boundary Invariants

| ID | Invariant | Tier | Authority | Location |
|----|-----------|------|-----------|----------|
| BND-001 | No cloud SDK in OSS paths | T4 | `validate:oss-purity` | `scripts/validate-oss-purity.ts` |
| BND-002 | No web imports in CLI | T4 | `validate:boundaries` | `scripts/validate-import-boundaries.ts` |
| BND-003 | Protocol is schema-only | T4 | File pattern lint | `scripts/validate-import-boundaries.ts` |
| BND-004 | Core doesn't import billing | T4 | Import boundary check | `scripts/validate-import-boundaries.ts` |

### 2.4 Replay Invariants

| ID | Invariant | Tier | Authority | Location |
|----|-----------|------|-----------|----------|
| RPL-001 | Event log reproduces execution | T3 | `VerifyReplay()` | `services/runner/internal/determinism/determinism.go:253` |
| RPL-002 | Events ordered deterministically | T2 | Event sequencer | `crates/engine/src/events.rs` |
| RPL-003 | Snapshots match after replay | T3 | `ReplaySnapshotMatches()` | `services/runner/internal/invariants/invariants.go:30` |

### 2.5 Isolation Invariants

| ID | Invariant | Tier | Authority | Location |
|----|-----------|------|-----------|----------|
| ISO-001 | Metrics don't affect fingerprint | T3 | Architecture review | `services/runner/internal/telemetry/metrics.go` |
| ISO-002 | Logs don't affect execution | T3 | Architecture review | `services/runner/internal/telemetry/logger.go` |
| ISO-003 | Transport errors are isolated | T2 | Error classification | `services/runner/internal/errors/classify.go` |
| ISO-004 | Side effects gated by interface | T2 | Adapter pattern | `services/runner/internal/storage/storage.go` |

---

## 3. Duplicate Elimination Log

### Consolidated: Hash Functions

**Before:** Multiple hash implementations
- `services/runner/internal/pack/merkle.go` - Merkle-specific
- `services/runner/internal/determinism/determinism.go` - General purpose
- `src/lib/hash.ts` - TypeScript BLAKE3

**After:** Single authority
- **Canonical:** `determinism.Hash()` in `determinism.go`
- **Reason:** One implementation, zero drift

### Consolidated: Canonicalization

**Before:** Multiple canonicalization paths
- `services/runner/internal/determinism/determinism.go` - Go maps
- `src/lib/canonical.ts` - TypeScript objects
- `src/engine/translate.ts` - Precision clamping

**After:** Single authority
- **Canonical:** `determinism.CanonicalJSON()` in `determinism.go`
- **Reason:** One serialization contract

### Consolidated: Fallback Logic

**Before:** Dual implementation
- `fallback.ts` - TypeScript algorithms
- `engine.rs` - Rust algorithms

**After:** Single authority
- **Canonical:** Rust/WASM in `crates/decision-engine/src/engine.rs`
- **Reason:** Single source of truth, no divergence risk

### Consolidated: Event Ordering

**Before:** Multiple sequencing strategies
- Go event processor
- Rust event sequencer

**After:** Single authority
- **Canonical:** Rust event sequencer in `crates/engine/src/events.rs`
- **Reason:** Deterministic order guaranteed by one component

---

## 4. Enforcement Matrix

| Invariant | Static | Unit | Integration | Property | Chaos |
|-----------|--------|------|-------------|----------|-------|
| DET-001 | - | ✅ | ✅ | ✅ | ✅ |
| DET-002 | - | ✅ | - | ✅ | - |
| DET-003 | - | - | ✅ | - | ✅ |
| DET-004 | ✅ | - | - | - | - |
| DET-005 | - | ✅ | - | ✅ | - |
| INT-001 | - | ✅ | ✅ | - | - |
| INT-002 | - | ✅ | - | ✅ | - |
| BND-001 | ✅ | - | - | - | - |
| BND-002 | ✅ | - | - | - | - |
| RPL-001 | - | - | ✅ | ✅ | ✅ |
| ISO-001 | ✅ | - | - | - | - |

---

## 5. Verification Commands

```bash
# Run all invariant tests
cargo test -p engine-core -- invariants
go test ./services/runner/internal/determinism/...
go test ./services/runner/internal/invariants/...

# Static analysis
npm run validate:boundaries
npm run validate:oss-purity

# Property-based testing
cargo test -p engine-core -- property_invariants

# Chaos testing
cargo test -p engine-core -- chaos

# Full gate
npm run verify:launch-gate
```

---

## 6. Authority Chain Example

```
User Request
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  API Layer (validation only)                                │
│  Authority: Input schema validation                         │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Translation Layer (canonicalization)                       │
│  Authority: determinism.CanonicalJSON()                     │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Hash Layer (single authority)                              │
│  Authority: determinism.Hash()                              │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Engine Layer (execution)                                   │
│  Authority: crates/decision-engine/src/engine.rs            │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Event Layer (sequencing)                                   │
│  Authority: crates/engine/src/events.rs                     │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Fingerprint Layer (verification)                           │
│  Authority: determinism.VerifyReplay()                      │
└─────────────────────────────────────────────────────────────┘
```

---

**Last Updated:** 2026-02-26  
**Manifest Version:** 1.0.0
