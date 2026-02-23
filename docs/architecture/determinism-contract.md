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
Rust: `crates/engine-core/src/invariants/mod.rs → canonical_hash()`

---

## 2. Deterministic Transformation Boundary

The **determinism boundary** is the set of functions where identical inputs
MUST produce identical outputs with zero tolerance.

### TypeScript Determinism Boundary

```
src/determinism/canonicalJson.ts    — Canonical JSON serialization
src/determinism/deterministicMap.ts — Sorted-key iteration
src/determinism/deterministicSort.ts — Locale-independent sorting
src/determinism/hashStream.ts       — SHA-256 streaming hash
src/determinism/seededRandom.ts     — Mulberry32 PRNG (FNV-1a seed)
src/core/zeolite-core.ts            — Decision execution pipeline
src/core/shim.ts                    — Core shim (hashInput, executeDecision)
src/lib/fallback.ts                 — Minimax regret / maximin / weighted sum
```

### Go Determinism Boundary

```
src/go/hash.go       — CanonicalJSON + SHA-256
src/go/diff.go       — Run comparison (structural equality)
src/go/verify.go     — N-trial determinism verification
```

### Rust Determinism Boundary

```
crates/engine-core/src/invariants/mod.rs — FNV-1a canonical hash
crates/engine-core/src/lib.rs            — Replay state, snapshot guards
crates/engine-core/src/decision/         — Classical decision algorithms
```

---

## 3. Hash Inclusion Rules

### What gets hashed

1. **Decision spec**: All fields of `DecisionSpec` (id, title, context, agents,
   actions, constraints, assumptions, objectives).
2. **Evidence events**: All fields including `id`, `type`, `sourceId`,
   `capturedAt`, `checksum`, `observations`, `claims`, `constraints`.
3. **Dependency graph**: `dependsOn` and `informs` arrays.

### How it gets hashed

1. Input is serialized to JSON via `JSON.stringify()` (TypeScript) or
   `json.Marshal()` (Go).
2. Go's `encoding/json` sorts map keys alphabetically by default.
3. TypeScript's `canonicalJson()` recursively sorts object keys before
   stringifying.
4. The resulting bytes are hashed with SHA-256 (TypeScript/Go) or FNV-1a (Rust
   hot path).
5. The hex digest is the canonical fingerprint.

### Hash Algorithm Registry

| Layer      | Algorithm | Use Case                    | Output Format |
| :--------- | :-------- | :-------------------------- | :------------ |
| TypeScript | SHA-256   | Transcript hash, input hash | hex string    |
| Go         | SHA-256   | Run fingerprint             | hex string    |
| Rust       | FNV-1a    | Canonical payload hash      | 16-char hex   |

**Invariant**: The same logical input must produce the same hash regardless of
which language boundary computes it, provided the serialization is canonical.

---

## 4. Replay Equivalence Conditions

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

## 5. Nondeterminism Risk Map

### Risk 1: Map Iteration Order (Go)

- **Location**: Any Go code using `for k, v := range map`.
- **Status**: MITIGATED. Go's `encoding/json.Marshal` sorts keys. Direct map
  iteration in event construction paths must use sorted keys (documented in
  `DETERMINISM_DEBUGGING.md`).
- **Residual Risk**: LOW. Requires discipline in new Go code.

### Risk 2: Wall-Clock Timestamps

- **Location**: `time.Now()` in Go, `Date.now()` in TypeScript.
- **Status**: MITIGATED. `src/core/shim.ts` uses `resolveTimestamp()` which
  respects `ZEO_FIXED_TIME` env var. Deterministic mode uses epoch zero.
- **Residual Risk**: MEDIUM. `time.Now()` is used in `sqlite.go:106` for
  artifact metadata timestamps. This is outside the hash boundary but could
  affect replay ordering if artifact timestamps are ever included in proofs.
- **Action**: Ensure artifact `created_at` is never included in hash
  computation. Add a lint rule.

### Risk 3: Float Encoding

- **Location**: `(0.2 + idx * 0.05).toFixed(4)` in `zeolite-core.ts`.
- **Status**: MANAGED. All float intermediates use `toFixed()` before inclusion
  in any canonical output. IEEE 754 double precision is consistent across
  platforms for the same arithmetic operations.
- **Residual Risk**: LOW. Edge cases with very large or very small floats could
  produce platform-dependent rounding. Current usage stays within safe ranges.

### Risk 4: Time Zones

- **Location**: `new Date().toISOString()` calls.
- **Status**: MITIGATED. `toISOString()` always produces UTC. Deterministic mode
  timestamps use `"1970-01-01T00:00:00.000Z"`.
- **Residual Risk**: NEGLIGIBLE.

### Risk 5: JSON Serialization Order

- **Location**: Every `JSON.stringify()` call in hash-contributing paths.
- **Status**: MITIGATED. `canonicalJson()` sorts all keys recursively.
  `hashInput()` in `shim.ts` uses `JSON.stringify()` but only on a
  pre-constructed object with fixed key order.
- **Residual Risk**: LOW. The `hashInput()` function reconstructs the stable
  payload with explicit key ordering (`spec`, `evidence`, `dependsOn`,
  `informs`). V8's `JSON.stringify()` preserves insertion order for
  string-keyed properties on ordinary objects, which is specified by ECMA-262.

### Risk 6: `localeCompare` Usage

- **Location**: `src/lib/fallback.ts` — tie-breaking sorts use
  `a.localeCompare(b)`.
- **Status**: RISK. `localeCompare` without an explicit locale argument uses the
  system default locale, which can vary across machines.
- **Impact**: Could affect action ranking tie-breaks in minimax regret fallback.
- **Severity**: LOW (only affects tie-breaks where values are ε-close).
- **Recommendation**: Replace with code-point comparison (`a < b ? -1 : 1`).

### Risk 7: Concurrent Goroutine Ordering

- **Location**: `services/runner/internal/agents/bridge.go:118` — batch
  requests processed in goroutines.
- **Status**: See Phase 2 (Concurrency Safety).

---

## 6. Test Coverage

### Existing Invariant Tests

| Test File                                          | Coverage Area            |
| :------------------------------------------------- | :----------------------- |
| `src/determinism/__tests__/canonicalJson.test.ts`  | All determinism utilities |
| `src/core/zeolite-core.test.ts`                    | Operation chain          |
| `src/go/stress_test.go`                            | Hash stability fixtures  |
| `crates/engine-core/src/invariants/mod.rs (tests)` | Canonical hash, semver   |

### Invariant Gaps

1. **No cross-language hash equivalence test.** TypeScript SHA-256 and Go
   SHA-256 should produce identical hashes for the same input, but this is not
   tested in CI.
2. **No float determinism boundary test.** The `toFixed()` paths are not tested
   for platform-specific edge cases.
3. **No `localeCompare` vs code-point comparison regression test** in fallback.ts.

---

## 7. Formal Invariants (Summary)

| ID     | Invariant                                           | Verified |
| :----- | :-------------------------------------------------- | :------- |
| DET-01 | Same input → same hash (TypeScript)                 | YES      |
| DET-02 | Same input → same hash (Go)                         | YES      |
| DET-03 | Same input → same hash (Rust)                       | YES      |
| DET-04 | Canonical JSON key ordering is recursive             | YES      |
| DET-05 | DeterministicMap iterates in sorted key order        | YES      |
| DET-06 | SeededRandom produces identical sequence for seed    | YES      |
| DET-07 | HashStream chunked == single update                  | YES      |
| DET-08 | combineHashes is order-sensitive                     | YES      |
| DET-09 | Replay produces identical transcript hash            | YES      |
| DET-10 | Cross-language hash equivalence                      | **NO**   |
| DET-11 | Float encoding stability across platforms            | **NO**   |
| DET-12 | Tie-break sorting is locale-independent              | **NO**   |
