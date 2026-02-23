# Determinism Contract

Last Updated: 2026-02-23

## Purpose

This document formally defines the determinism guarantees of the Reach system.
Every computation that contributes to a fingerprint, transcript hash, or replay
verdict MUST satisfy the invariants described here. Violations are treated as
bugs of the highest severity.

---

## 1. Deterministic Input Set

A **deterministic input** is the canonical set of values that fully determine
the output of a decision evaluation. The input set is:

| Field           | Type                          | Included in Hash | Notes                                          |
| :-------------- | :---------------------------- | :--------------- | :--------------------------------------------- |
| `spec`          | `DecisionSpec`                | YES              | Actions, assumptions, constraints, objectives   |
| `evidence`      | `EvidenceEvent[]`             | YES              | Ordered array; order is semantically meaningful |
| `dependsOn`     | `string[]`                    | YES              | Upstream transcript IDs                         |
| `informs`       | `string[]`                    | YES              | Downstream transcript IDs                       |

Fields explicitly **excluded** from the deterministic input hash:

| Field              | Reason                                                  |
| :----------------- | :------------------------------------------------------ |
| `logicalTimestamp`  | Changes between runs; does not alter decision outcome   |
| `opts.depth`        | Execution parameter, not decision-stable                |
| `opts.seed`         | Used for synthetic data; not part of decision logic     |

### Source of Truth

TypeScript: `src/core/shim.ts → hashInput()`
Go: `src/go/hash.go → Hash()`
Rust: `crates/engine-core/src/decision/determinism.rs → compute_fingerprint()`

---

## 2. Hash Version

All transcripts include a `hashVersion` field identifying the hash computation
pipeline. The current version is:

```
sha256-cjson-v1
```

This encodes:
- **Algorithm**: SHA-256
- **Serialization**: cjson (canonical JSON with recursively sorted keys)
- **Schema version**: v1

The constant is exported from `src/core/shim.ts` as `HASH_VERSION`.

### When to Bump

A hash version bump (`v1` → `v2`) is required when:

1. Hash algorithm changes (e.g., SHA-256 → SHA-3).
2. Hash input set changes (adding/removing fields from `hashInput()`).
3. Serialization format changes (e.g., switching to CBOR).
4. Canonical ordering algorithm changes.

---

## 3. Deterministic Transformation Boundary

The **determinism boundary** is the set of functions where identical inputs
MUST produce identical outputs with zero tolerance.

### TypeScript Determinism Boundary

```
src/determinism/canonicalJson.ts       — Canonical JSON serialization (sorted keys)
src/determinism/deterministicMap.ts    — Sorted-key iteration
src/determinism/deterministicSort.ts   — Locale-independent sorting
src/determinism/deterministicCompare.ts — Code-point string comparison (replaces localeCompare)
src/determinism/hashStream.ts          — SHA-256 streaming hash
src/determinism/seededRandom.ts        — Mulberry32 PRNG (FNV-1a seed)
src/core/zeolite-core.ts               — Decision execution pipeline
src/core/shim.ts                       — Core shim (hashInput, executeDecision)
src/lib/fallback.ts                    — Minimax regret / maximin / weighted sum
```

### Go Determinism Boundary

```
src/go/hash.go       — CanonicalJSON + SHA-256
src/go/diff.go       — Run comparison (structural equality)
src/go/verify.go     — N-trial determinism verification
```

### Rust Determinism Boundary

```
crates/engine-core/src/decision/determinism.rs — Canonical JSON + SHA-256
crates/engine-core/src/lib.rs                  — Replay state, snapshot guards
crates/engine-core/src/decision/               — Classical decision algorithms
```

---

## 4. Hash Inclusion Rules

### What gets hashed

1. **Decision spec**: All fields of `DecisionSpec` (id, title, context, agents,
   actions, constraints, assumptions, objectives).
2. **Evidence events**: All fields including `id`, `type`, `sourceId`,
   `capturedAt`, `checksum`, `observations`, `claims`, `constraints`.
3. **Dependency graph**: `dependsOn` and `informs` arrays.

### How it gets hashed

1. Input is serialized via `canonicalJson()` (TypeScript) or `CanonicalJSON()`
   (Go), which recursively sorts all object keys alphabetically.
2. The resulting canonical JSON string is hashed with SHA-256.
3. The hex digest is the canonical fingerprint.

**Critical**: `JSON.stringify()` MUST NOT be used directly in hash-contributing
paths. All hashing goes through `canonicalJson()` to guarantee key order.

### Hash Algorithm Registry

| Layer      | Algorithm | Use Case                    | Output Format |
| :--------- | :-------- | :-------------------------- | :------------ |
| TypeScript | SHA-256   | Transcript hash, input hash | hex string    |
| Go         | SHA-256   | Run fingerprint             | hex string    |
| Rust       | SHA-256   | Canonical payload hash      | hex string    |

**Invariant**: The same logical input must produce the same hash regardless of
which language boundary computes it, provided the serialization is canonical.

---

## 5. Replay Equivalence Conditions

A replay is **equivalent** if and only if:

1. `replay_hash == original_hash` (transcript hash matches).
2. The event log produced during replay is structurally identical to the
   original event log (same events, same order, same payloads).
3. No additional events are emitted during replay.
4. No events are missing from the replay.

### Replay Verdict

| Verdict          | Condition                                         |
| :--------------- | :------------------------------------------------ |
| `PASS`           | All hashes match, event logs identical            |
| `REPLAY_DIVERGED`| Hash mismatch detected                            |
| `ENGINE_VERSION_MISMATCH` | Engine binary version ≠ manifest version |

---

## 6. Nondeterminism Risk Map

### Risk 1: Map Iteration Order (Go)

- **Location**: Any Go code using `for k, v := range map`.
- **Status**: MITIGATED. Go's `encoding/json.Marshal` sorts keys. Direct map
  iteration in event construction paths must use sorted keys.
- **Residual Risk**: LOW.

### Risk 2: Wall-Clock Timestamps

- **Location**: `time.Now()` in Go, `Date.now()` in TypeScript.
- **Status**: MITIGATED. `src/core/shim.ts` uses `resolveTimestamp()` which
  respects `ZEO_FIXED_TIME` env var. Deterministic mode uses epoch zero.
- **Residual Risk**: LOW. `Date.now()` is used in operational paths (cache
  cleanup, telemetry latency) that are **outside** the hash boundary.

### Risk 3: Float Encoding

- **Location**: `(0.2 + idx * 0.05).toFixed(4)` in `zeolite-core.ts`.
- **Status**: MITIGATED. All float intermediates use `toFixed()` before inclusion
  in canonical output. Tested in DET-11 test suite.
- **Residual Risk**: LOW.

### Risk 4: Time Zones

- **Location**: `new Date().toISOString()` calls.
- **Status**: MITIGATED. `toISOString()` always produces UTC.
- **Residual Risk**: NEGLIGIBLE.

### Risk 5: JSON Serialization Order

- **Location**: Every hash-contributing path.
- **Status**: MITIGATED. All hash-contributing paths use `canonicalJson()` which
  recursively sorts keys. Raw `JSON.stringify()` is prohibited in hash paths.
- **Residual Risk**: NEGLIGIBLE.

### Risk 6: `localeCompare` Usage

- **Location**: Multiple CLI modules and `lib/` utilities use `localeCompare`.
- **Status**: PARTIALLY MITIGATED. `src/determinism/deterministicCompare.ts`
  provides `codePointCompare()` for locale-independent comparison. The fallback
  algorithms (`src/lib/fallback.ts`) use code-point comparison for tie-breaks.
  CLI display-layer sorts still use `localeCompare` — these are outside the
  determinism boundary but should be migrated for consistency.
- **Residual Risk**: LOW for hash-contributing paths. MEDIUM for display consistency.

### Risk 7: Concurrent Goroutine Ordering

- **Location**: `services/runner/internal/agents/bridge.go:118`.
- **Status**: DOCUMENTED. Go concurrent processing paths must sort results
  before inclusion in any deterministic output.

---

## 7. Prohibited Sources of Nondeterminism

The following are PROHIBITED in any code within the determinism boundary:

1. `Math.random()` — use `seededRandom()` instead.
2. `Date.now()` — use `resolveTimestamp()` or deterministic mode clock.
3. `localeCompare()` without explicit locale — use `codePointCompare()`.
4. Raw `JSON.stringify()` in hash paths — use `canonicalJson()`.
5. Map/object iteration without sorted keys.
6. `process.env` reads that alter computation output without explicit validation.
7. Goroutine result ordering without explicit sort.
8. Filesystem directory listing without sort.

---

## 8. Test Coverage

### Invariant Test Suite

| Test File                                          | Coverage Area                    |
| :------------------------------------------------- | :------------------------------- |
| `src/determinism/determinism-invariants.test.ts`   | All determinism invariants       |
| `src/determinism/crossLanguageHash.test.ts`        | Cross-language hash structure    |
| `src/core/zeolite-core.test.ts`                    | Operation chain determinism      |
| `src/go/cross_language_hash_test.go`               | Go golden hash verification      |
| `services/runner/internal/determinism/*_test.go`    | Go hash/replay determinism       |
| `crates/engine-core/src/decision/determinism.rs`    | Rust canonical hash              |

### Test Categories

| Category                     | Test Count | Status |
| :--------------------------- | :--------- | :----- |
| Golden hash assertions       | 5          | PASS   |
| Float encoding boundary      | 4          | PASS   |
| Locale-independent sorting   | 4          | PASS   |
| Hash version enforcement     | 2          | PASS   |
| 100-iteration stress         | 5          | PASS   |
| Adversarial mutation         | 8          | PASS   |
| Large-scale replay           | 2          | PASS   |
| Sort utilities               | 3          | PASS   |
| HashStream edge cases        | 4          | PASS   |

---

## 9. Formal Invariants (Summary)

| ID     | Invariant                                           | Verified | Test ID |
| :----- | :-------------------------------------------------- | :------- | :------ |
| DET-01 | Same input → same hash (TypeScript)                 | YES      | stress  |
| DET-02 | Same input → same hash (Go)                         | YES      | Go test |
| DET-03 | Same input → same hash (Rust)                       | YES      | Rust    |
| DET-04 | Canonical JSON key ordering is recursive             | YES      | DET-10  |
| DET-05 | DeterministicMap iterates in sorted key order        | YES      | stress  |
| DET-06 | SeededRandom produces identical sequence for seed    | YES      | stress  |
| DET-07 | HashStream chunked == single update                  | YES      | edge    |
| DET-08 | combineHashes is order-sensitive                     | YES      | advers. |
| DET-09 | Replay produces identical transcript hash            | YES      | stress  |
| DET-10 | Cross-language hash equivalence (golden)             | YES      | DET-10  |
| DET-11 | Float encoding stability across platforms            | YES      | DET-11  |
| DET-12 | Tie-break sorting is locale-independent              | YES      | DET-12  |
| VER-04 | Hash version constant in transcripts                 | YES      | VER-04  |

---

## 10. Cross-Language Golden Hashes

These are the canonical reference hashes. All language implementations MUST
produce these exact hashes for the given inputs:

| Input Description           | Canonical JSON                                          | SHA-256 Hash                                                     |
| :-------------------------- | :------------------------------------------------------ | :--------------------------------------------------------------- |
| Simple flat object          | `{"action":"deploy","environment":"production"}`         | `165b836d9d6e803d5ce1bb8b7a01437ff68928f549887360cf13a0d551a66e85` |
| Nested with sorted keys     | `{"a":1,"b":2,"c":{"a":1,"z":26}}`                      | `24e4db09ae0e40a93e391725f9290725f3a8ffd15d33ed0bb39c394319087492` |
| Empty object                | `{}`                                                     | `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a` |
| Array with mixed types      | `{"items":[1,"two",true,null,{"nested":"value"}]}`       | `7f76a9a8e0bec70c5d327b1ee560378ec256372034993f7cb7b676c77992f5cc` |
| Unicode content             | `{"emoji":"🎯","name":"日本語テスト"}`                     | `124cab98f548209aa0b1ea432e5bbf239f2327d65f519a32420fa5f1a67433cc` |
