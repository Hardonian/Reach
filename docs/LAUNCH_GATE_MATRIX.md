# Launch Gate Matrix: Requiem ↔ Reach Cutover

**Version**: 1.0  
**Date**: 2026-02-26  
**Status**: IN PROGRESS  
**Mission**: Merge-blocking reality-proof launch gate for Requiem/Reach integration

---

## Severity Definitions

| Severity | Definition | Merge Blocker |
|----------|------------|---------------|
| **CRITICAL** | Determinism/security boundary break | ✅ YES |
| **HIGH** | Scale/reliability risk | ✅ YES (unless behind flag with safe default) |
| **MED** | Quality/ops issue | ⏭️ Can ship with tracked issue |
| **LOW** | Polish/cleanup | ⏭️ Post-launch |

---

## Gate Inventory

| Gate | Severity | Requirement | Automated Proof | Current Status | Fix Plan | Owner |
|------|----------|-------------|-----------------|----------------|----------|-------|
| **A-Hash** | CRITICAL | BLAKE3 only; no fallback; EngineAdapter fails closed on mismatch | `verify:hash` script + unit test | ⚠️ PARTIAL - Vendored BLAKE3 in Requiem, Reach uses @napi-rs/blake3 (missing) | Fix @napi-rs/blake3 import; add hash_primitive enforcement in HELLO | engine-core |
| **A-Handshake** | CRITICAL | HELLO negotiation enforces hash_version='blake3' | Protocol client unit test | ⚠️ PARTIAL - HELLO exists but strict enforcement missing | Add strict check in HelloAck handling | protocol/client |
| **B-Protocol** | CRITICAL | Binary framed protocol default; JSON/temp-file only in debug mode | `verify:protocol` script | ⚠️ PARTIAL - Protocol client exists but type errors prevent build | Fix type mismatches; add REACH_PROTOCOL=json gate | protocol/client |
| **B-Framing** | CRITICAL | Length-prefixed CBOR frames; no stdout parsing | Protocol client tests | ⚠️ PARTIAL - Frame implementation exists | Add negative test cases (truncation, corruption) | protocol/frame |
| **C-Canonical** | CRITICAL | Exactly one canonicalization contract; golden vectors | `verify:canonical` script | ⚠️ PARTIAL - sortObjectKeys in base.ts, but no golden fixtures | Add golden vector tests; freeze canonicalization | engine/contract |
| **D-FixedPoint** | CRITICAL | No floats in digest path; Q32.32 fixed-point | Unit tests for Q32.32 conversions | ✅ PASS - FixedQ32_32 type exists in messages.ts | Verify no f64 in digest calculation paths | engine-core |
| **E-Sandbox** | CRITICAL | Path traversal blocked; symlink/TOCTOU protection | `verify:security` script | ⚠️ PARTIAL - validateResourceLimits exists | Add realpath confinement; symlink race tests | engine/storage |
| **E-Extraction** | CRITICAL | Pack extraction blocks traversal/symlinks | CAS integrity tests | ⚠️ NOT IMPLEMENTED - Need extraction sandbox | Implement extraction sandbox with path confinement | engine/storage |
| **F-EnvIsolation** | CRITICAL | Engine spawn strips secrets (REACH_ENCRYPTION_KEY, *_TOKEN, *_SECRET, *_KEY) | `verify:env` script | ⚠️ NOT IMPLEMENTED - No env allowlist in spawn | Add env blocklist/allowlist; secret stripping | engine/adapters |
| **G-CAS** | CRITICAL | Atomic writes (tmp+rename); on-read hash verification | `verify:cas` script | ✅ PASS - put_atomic in Requiem | Add on-read verification; corruption detection tests | engine/storage/cas |
| **H-LLMFreeze** | CRITICAL | CID-only reference; verify on read; corrupted cache fails | Unit tests for LLM cache | ⚠️ NOT VERIFIED - Need cache corruption tests | Add CID verification; corruption failure tests | engine/cache |
| **I-Immutability** | HIGH | Result frozen+hashed before mutable hooks | Unit tests for result lifecycle | ⚠️ NOT VERIFIED - Need freeze-then-hash proof | Implement Object.freeze + hash verification | engine/contract |
| **J-Daemon** | HIGH | UUID pipes/sockets; heartbeat; no zombies; backpressure | Integration tests | ⚠️ PARTIAL - Protocol client has reconnection | Add heartbeat; zombie process detection | protocol/client |
| **K-ResourceLimits** | HIGH | Request size cap (10MB); max frame bytes; matrix bounds | validateResourceLimits tests | ✅ PASS - DEFAULT_RESOURCE_LIMITS defined | Add OOM protection (rlimit/Job Object integration) | engine/adapters/base |
| **L-Parity** | CRITICAL | Identical fingerprint Linux + Windows | `verify:parity` script CI | ⚠️ NOT IMPLEMENTED - Cross-platform fixture needed | Add deterministic fixture; CI cross-platform compare | ci/parity |
| **M-DriftWatch** | HIGH | 200x determinism repeat; drift fixture; bench regression | `verify:determinism` script | ⚠️ PARTIAL - scan-determinism.ts exists | Upgrade to 200x repeat; add regression threshold | scripts/verify |

---

## Detailed Gate Specifications

### A-Hash: Hash Truth

**Requirement**: BLAKE3 must be the exclusive hash primitive. No algorithm fallback permitted. EngineAdapter must fail closed (error, not degrade) on hash mismatch.

**Evidence Required**:
1. Requiem: `hash_backend: "vendored"` in health output
2. Reach: Uses BLAKE3 via @napi-rs/blake3 or falls back to crypto.createHash with error
3. HELLO negotiation: Both sides agree on hash_version='blake3'

**Current Issues**:
- `src/engine/translate.ts:16` - Cannot find module '@napi-rs/blake3'
- No explicit hash mismatch error handling in ProtocolEngineAdapter

**Fix**:
```typescript
// In protocol adapter HELLO handling
if (helloAck.hash_version !== 'blake3') {
  throw new Error(`hash_primitive_mismatch: expected blake3, got ${helloAck.hash_version}`);
}
```

---

### B-Protocol: Protocol Truth

**Requirement**: Binary framed protocol must be default. JSON/temp-file fallback only when `REACH_PROTOCOL=json` explicitly set (debug mode).

**Evidence Required**:
1. ProtocolEngineAdapter uses ProtocolClient by default
2. RequiemEngineAdapter (JSON CLI) only used when useJsonFallback=true
3. Environment check: `process.env.REACH_PROTOCOL === 'json'` gates fallback

**Current Issues**:
- Type errors in protocol.ts prevent build:
  - `metadata` property missing on ExecResultPayload
  - `deriveSeed` method missing on ProtocolEngineAdapter
  - `ranking` type mismatch (string[] vs object[])
  - `pending` status not in union

**Fix**: Update contract types or protocol adapter to match.

---

### C-Canonical: Canonicalization Truth

**Requirement**: Exactly one canonical JSON contract. No JSON.stringify drift. Golden vectors for hash verification.

**Evidence Required**:
1. sortObjectKeys() used for all JSON→hash paths
2. Golden fixtures with known digests
3. No platform-specific ordering (localeCompare with 'en')

**Current State**:
- sortObjectKeys in base.ts
- deterministicSort with localeCompare
- Missing: Golden vectors

---

### E-Sandbox: Workspace/Sandbox Escape

**Requirement**: Pack extraction and file access must block path traversal and symlink attacks.

**Evidence Required**:
1. realpath() resolution before access
2. Path prefix verification (workspace_root containment)
3. Symlink race protection (O_NOFOLLOW or equivalent)
4. TOCTOU mitigation

**Current State**:
- validateResourceLimits exists
- No path traversal protection in extraction paths

---

### F-EnvIsolation: Environment/Secrets Isolation

**Requirement**: Child process environment must be explicitly allowlisted. Secrets stripped.

**Evidence Required**:
1. env_allowlist in execution config
2. Blocklist for: REACH_ENCRYPTION_KEY, *_TOKEN, *_SECRET, *_KEY
3. Test verifying secrets not in child env

**Current State**:
- No env filtering in adapter spawn

---

### G-CAS: CAS Integrity

**Requirement**: Atomic writes (tmp+rename), on-read hash verification, corruption detection.

**Evidence Required**:
1. put_atomic implementation (temp file + rename)
2. get() verifies hash matches content
3. Corruption detection test with mutated bytes

**Current State**:
- Requiem has put_atomic()
- Reach CAS implementation needs verification

---

### L-Parity: Cross-platform Parity

**Requirement**: Identical fingerprint for identical inputs on Linux and Windows.

**Evidence Required**:
1. Deterministic fixture runs on both platforms
2. Stored baseline digests match
3. No platform-specific paths in digest inputs

**Current State**:
- No cross-platform parity tests

---

## Automated Proof Scripts

### Required New Scripts

| Script | Purpose | Gates Covered |
|--------|---------|---------------|
| `verify:hash` | Hash primitive enforcement, backend verification | A-Hash, A-Handshake |
| `verify:protocol` | Binary framing smoke, negative cases | B-Protocol, B-Framing |
| `verify:canonical` | Golden vector hash verification | C-Canonical |
| `verify:security` | Path traversal, symlink race, env isolation | E-Sandbox, E-Extraction, F-EnvIsolation |
| `verify:cas` | Atomic write, corruption detection | G-CAS |
| `verify:parity` | Cross-platform fingerprint compare | L-Parity |
| `verify:determinism` | 200x repeat, drift detection | M-DriftWatch |

### Script Requirements

Each script must:
1. Exit 0 on pass, 2 on CRITICAL failure, 1 on HIGH failure
2. Output JSON report to stdout
3. Support `--ci` flag for CI-optimized output
4. Have corresponding unit tests

---

## CI Integration

### New Workflow: `launch-gate.yml`

```yaml
name: launch-gate
on:
  pull_request:
    paths:
      - 'src/engine/**'
      - 'src/protocol/**'
      - 'crates/**'
jobs:
  critical-gates:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
    steps:
      - run: npm run verify:hash
      - run: npm run verify:protocol
      - run: npm run verify:canonical
      - run: npm run verify:security
      - run: npm run verify:cas
      - run: npm run verify:determinism -- --count 200
      - run: npm run verify:parity  # Compares Linux vs Windows baseline
```

---

## Implementation Priority

### Phase 3: Close CRITICAL Gates (Immediate)

1. **A-Hash**: Fix @napi-rs/blake3 import, add HELLO enforcement
2. **B-Protocol**: Fix type errors in protocol.ts
3. **C-Canonical**: Add golden vectors
4. **E-Sandbox**: Add path traversal protection
5. **F-EnvIsolation**: Implement env allowlist
6. **L-Parity**: Create cross-platform fixtures

### Phase 4: Block HIGH Gates

1. **I-Immutability**: Add freeze-then-hash
2. **J-Daemon**: Heartbeat implementation
3. **M-DriftWatch**: Upgrade to 200x repeat

---

## Current Status Summary

| Category | Count | Status |
|----------|-------|--------|
| CRITICAL Gates | 8 | 1 PASS, 5 PARTIAL, 2 NOT IMPLEMENTED |
| HIGH Gates | 3 | 1 PASS, 2 PARTIAL |
| MED Gates | 0 | - |
| LOW Gates | 0 | - |

### Merge Decision Blockers

**Current**: 🔴 MERGE BLOCKED

**Required to unblock**:
1. Fix typecheck errors in protocol.ts
2. Implement hash_primitive enforcement in HELLO
3. Add path traversal protection
4. Implement env isolation
5. Add golden vectors for canonicalization
6. Cross-platform parity tests

---

## Sign-off

| Role | Status | Date |
|------|--------|------|
| Security Review | ⏭️ Pending | - |
| Determinism Audit | ⏭️ Pending | - |
| Cross-platform Parity | ⏭️ Pending | - |
| Final Merge Approval | 🔴 BLOCKED | - |
