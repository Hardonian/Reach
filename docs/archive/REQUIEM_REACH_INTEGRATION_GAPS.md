# Requiem ↔ Reach Integration Gap Matrix

**Date**: 2026-02-26
**Mode**: Holistic Integration Audit + Gap Closure + Hardening Pass
**Status**: In Progress

---

## Executive Summary

This document identifies critical integration gaps between Reach and Requiem C++ engine. The most severe issue is a **critical determinism violation** caused by inconsistent hash primitives across the system, which will cause fingerprint instability and break replay verification.

---

## Gap Matrix

| Area | Current State | Severity | Determinism Risk | Security Risk | Acceptance Criteria | Tests Present? | Action Required |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: | :--- |
| **Hash Primitive Alignment** | Multiple hash algos: BLAKE3 (TS CAS), SHA-256 (decision-engine), FNV-1a (engine-core), BLAKE3 (Requiem) | **CRITICAL** | HIGH - Fingerprint instability | LOW | All fingerprint-contributing code MUST use single hash algo (BLAKE3) | No | **IMMEDIATE**: Unify all hashes to BLAKE3 across Reach/Requiem |
| **Canonical JSON Boundary** | Different canonicalization in translate.ts vs C++ jsonlite.cpp | **CRITICAL** | HIGH - Different serialization | LOW | Single canonical JSON implementation shared across boundary | Partial | **IMMEDIATE**: Ensure canonical JSON matches between TS and C++ |
| **Float Precision** | `$10^{-10}$` rounding in translate.ts not enforced in C++ | **CRITICAL** | HIGH - Floating point drift | LOW | Fixed-point or 10-decimal precision in both TS and C++ | No | **IMMEDIATE**: Enforce float precision in C++ or use fixed-point |
| **Temp File I/O Path** | Default execution uses CLI temp-file mode | **HIGH** | MEDIUM - Non-deterministic temp handling | MEDIUM | Must use streaming protocol by default; temp-file only debug | Yes | Change default to streaming protocol |
| **Env Allowlist** | Basic allowlist exists but incomplete | **HIGH** | MEDIUM - Entropy from env | HIGH | Explicit allowlist for all engine spawn env vars | Yes | Expand allowlist, add deny patterns |
| **Path Traversal** | Basic sanitization in requestId | **HIGH** | LOW | HIGH | Full path traversal defense in all input paths | Yes | Verify complete coverage |
| **CAS Atomic Writes** | Uses basic fs operations | **HIGH** | MEDIUM - Possible corruption | MEDIUM | Atomic write + rename for all CAS entries | No | **IMMEDIATE**: Implement atomic writes |
| **LLM Freeze CID** | Basic computeCID exists | **MEDIUM** | MEDIUM - Poisoning risk | HIGH | Verify CID on read for all LLM freeze artifacts | Partial | Add full CID verification on read |
| **Plugin Mutation** | No post-hash mutation guard | **MEDIUM** | HIGH - Result tampering | HIGH | Seal results after engine return, before hash | No | Add result sealing |
| **Daemon Lifecycle** | Basic start/shutdown exists | **MEDIUM** | LOW | MEDIUM | Heartbeat + re-challenge every N requests | No | Add heartbeat mechanism |
| **Tie-Break Determinism** | Not enforced in decision engine | **MEDIUM** | HIGH - Non-deterministic output | LOW | Alphabetical ActionID sort for equal scores | No | Enforce deterministic tie-break |
| **Concurrency Semaphore** | Basic ProcessSemaphore in base adapter | **MEDIUM** | LOW | MEDIUM | Cap concurrent processes at min(CPU_COUNT, 32) | Yes | Tune for production load |
| **MAX_FRAME_BYTES** | Not enforced in protocol client | **MEDIUM** | LOW | HIGH | Frame size limits enforced | No | Add frame size limits |
| **UUID Named Pipes** | Uses PID-based naming | **LOW** | LOW | MEDIUM | UUID-named pipes for isolation | No | Consider for daemon mode |
| **Binary Version Lock** | Basic version check exists | **MEDIUM** | LOW | MEDIUM | Strict semver enforcement | Partial | Strengthen version pinning |
| **Cross-Platform Parity** | POSIX/Win32 split in sandbox | **MEDIUM** | MEDIUM | LOW | Same behavior on Linux + Windows | No | Add integration tests |
| **Scale Bottlenecks** | Process-per-request model | **HIGH** | MEDIUM | MEDIUM | 200+ concurrent requests without EMFILE/OOM | No | Add stress tests |
| **CI Determinism Watchdog** | No continuous drift detection | **HIGH** | HIGH | LOW | Run fixture 100x in CI | No | Add drift CI check |

---

## Critical Items Identified

### 1. Hash Primitive Mismatch (CRITICAL)

**Location**: Multiple files across Reach and Requiem

**Current State**:
- TypeScript CAS (`src/engine/storage/cas.ts`): Uses BLAKE3
- TypeScript HashStream (`src/determinism/hashStream.ts`): Uses BLAKE3
- Decision Engine (`crates/decision-engine/src/determinism.rs`): Uses SHA-256
- Engine Core Invariants (`crates/engine-core/src/invariants/mod.rs`): Uses FNV-1a
- Requiem C++ (`crates/requiem/src/server.rs`): Uses BLAKE3
- Various CLI tools: Use SHA-256

**Risk**: Fingerprint instability - identical runs produce different hashes depending on which component processes them.

**Required Fix**: Unify all hash operations to use BLAKE3 exclusively. This is the canonical hash primitive already used by CAS and Requiem.

### 2. Canonical JSON Mismatch (CRITICAL)

**Location**: 
- `src/engine/translate.ts` (TypeScript)
- `../Requiem/src/jsonlite.cpp` (C++)

**Current State**: Different JSON serialization approaches may produce different outputs for equivalent data.

**Required Fix**: Ensure canonical JSON matches between TypeScript and C++ implementations.

### 3. Float Precision Drift (CRITICAL)

**Location**:
- `src/engine/translate.ts`: Has `$10^{-10}$` rounding
- `../Requiem/src/runtime.cpp`: No explicit precision control

**Risk**: Floating-point precision differences cause fingerprint mismatch.

**Required Fix**: Enforce 10-decimal precision in C++ or use fixed-point arithmetic.

### 4. CAS Non-Atomic Writes (CRITICAL)

**Location**: `src/engine/storage/cas.ts`

**Risk**: Concurrent writes can result in partial/corrupted artifacts.

**Required Fix**: Implement atomic write-then-rename pattern.

---

## High Priority Items

### 5. Temp File Default Execution Path
- Current default may use temp-file mode instead of streaming protocol
- Need to verify and fix default behavior

### 6. Environment Allowlist Incomplete
- Current allowlist is basic
- Need deny patterns for sensitive vars

### 7. Path Traversal Coverage
- Basic sanitization exists for requestId
- Need comprehensive coverage for all user inputs

### 8. Daemon Heartbeat Missing
- No periodic health check for long-running daemon
- Need heartbeat mechanism

---

## Medium Priority Items

### 9. Plugin Result Mutation Risk
- No guard against post-engine result tampering

### 10. Tie-Break Non-Determinism
- Equal scores may produce different results

### 11. Cross-Platform Test Coverage
- Need Linux + Windows verification

### 12. Scale Stress Testing
- No 200+ concurrent request tests

---

## Verification Status

| Check | Status |
| :--- | :--- |
| validate:language | ✅ PASSED |
| validate:boundaries | ✅ PASSED |
| validate:oss-purity | ✅ PASSED |
| validate:site-claims | ✅ PASSED |
| validate:site-boundaries | ✅ PASSED |
| validate:engines | ✅ PASSED |
| validate:packs | ⚠️ FAIL (WSL/bash issue) |
| go vet ./... | ✅ PASSED |
| cargo clippy | ⚠️ NOT AVAILABLE (env) |

---

## Action Plan

### Immediate (CRITICAL - Before Merge)

1. **Unify Hash Primitives**
   - Change decision-engine to use BLAKE3
   - Change engine-core to use BLAKE3
   - Add test to verify all hashes use BLAKE3

2. **Fix CAS Atomic Writes**
   - Implement write-then-rename pattern
   - Add verification on read

3. **Canonical JSON Alignment**
   - Compare TS and C++ implementations
   - Add golden fixture tests

4. **Float Precision**
   - Add 10-decimal enforcement in C++ or use fixed-point

### Short-Term (HIGH - This Sprint)

5. Default to streaming protocol
6. Expand environment allowlist
7. Add daemon heartbeat
8. Implement tie-break determinism

### Medium-Term

9. Plugin result sealing
10. Cross-platform integration tests
11. Scale stress tests
12. CI determinism watchdog

---

## Files Requiring Changes

### Reach Repository

| File | Change Type | Priority |
| :--- | :--- | :--- |
| `crates/decision-engine/src/determinism.rs` | Hash algo change | CRITICAL |
| `crates/engine-core/src/invariants/mod.rs` | Hash algo change | CRITICAL |
| `src/engine/storage/cas.ts` | Atomic writes | CRITICAL |
| `src/engine/translate.ts` | Precision enforcement | CRITICAL |
| `src/engine/adapters/protocol.ts` | Default mode change | HIGH |
| `src/engine/adapters/requiem.ts` | Env allowlist expansion | HIGH |

### Requiem Repository

| File | Change Type | Priority |
| :--- | :--- | :--- |
| `src/jsonlite.cpp` | Canonical JSON alignment | CRITICAL |
| `src/runtime.cpp` | Float precision | CRITICAL |
| `src/cas.cpp` | Atomic writes | CRITICAL |
| `src/server.rs` | Hash verification | CRITICAL |

---

## Test Coverage Gaps

| Test | Status | Location |
| :--- | :--- | :--- |
| Hash primitive consistency | ❌ MISSING | Need new test |
| Canonical JSON parity | ⚠️ PARTIAL | `src/determinism/__tests__/` |
| Float precision determinism | ❌ MISSING | Need new test |
| CAS atomic writes | ❌ MISSING | Need new test |
| 200 concurrent requests | ❌ MISSING | Need new test |
| 100x repeat determinism | ❌ MISSING | Need new test |

---

## Conclusion

The system has a **critical determinism violation** that must be fixed before merge. The hash primitive mismatch between BLAKE3, SHA-256, and FNV-1a will cause fingerprint instability and break replay verification.

**Recommended Action**: Block merge until all CRITICAL items are resolved. The unified hash strategy should be BLAKE3 across all components.

---

*Document will be updated as gaps are closed.*
