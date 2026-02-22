# Determinism Specification — Reach V1

Last Updated: 2026-02-22

## Foundational Invariant

Determinism is the core guarantee of the Reach protocol:

> **Given identical inputs, policies, and artifacts, every execution MUST produce byte-identical outputs and the same SHA-256 fingerprint, on any machine, at any time.**

Violations of this invariant are treated as critical bugs with immediate rollback priority.

---

## Canonical Run Model

Every Reach Run is described by an immutable model that serves as the source for its fingerprint:

```json
{
  "run_id":          "<sha256-derived-from-pack-hash + input-hash + sequence>",
  "engine_version":  "<semver, e.g. 0.2.0>",
  "policy_version":  "<sha256 of policy bundle>",
  "input_hash":      "<sha256 of canonical-JSON of inputs>",
  "artifact_hashes": ["<sha256 of each artifact, sorted by artifact ID>"],
  "output_hash":     "<sha256 of canonical-JSON of outputs>",
  "event_log_hash":  "<sha256 of NDJSON event log, in insertion order>",
  "timestamp_epoch": 0,
  "fingerprint":     "<sha256(run_id + engine_version + event_log_hash)>"
}
```

### Field Invariants

| Field | Invariant |
| :--- | :--- |
| `run_id` | Derived from content hash (never UUID v4). Same inputs → same `run_id`. |
| `engine_version` | Pinned to the exact engine release. Must be bumped when behavior changes. |
| `policy_version` | SHA-256 of the policy bundle contents. Policy changes create a new version. |
| `input_hash` | SHA-256 of the canonical-JSON serialization of all inputs (sorted keys). |
| `artifact_hashes` | Array of SHA-256 hashes, sorted by artifact ID lexicographically. |
| `output_hash` | SHA-256 of canonical-JSON outputs (sorted keys, normalized values). |
| `event_log_hash` | SHA-256 of the ordered NDJSON event log. Order is insertion order — not timestamps. |
| `timestamp_epoch` | Always `0` in deterministic paths. Wall-clock timestamps are excluded from fingerprint calculation. |
| `fingerprint` | The final proof: `SHA-256(run_id \|\| engine_version \|\| event_log_hash)`. |

---

## Serialization Rules

All JSON destined for hashing MUST follow these rules:

1. **Sorted keys**: Object keys sorted lexicographically (UTF-8 byte order).
2. **No trailing whitespace or newlines** in the serialized buffer before hashing.
3. **Number normalization**: Floating-point values forbidden in fingerprint paths. Use integers or string-encoded decimals.
4. **Null handling**: Explicitly encode `null` for absent optional fields (do not omit).
5. **Array ordering**: Arrays that are order-sensitive must NOT be re-sorted by the hasher. The caller is responsible for providing arrays in stable order.

### Reference Implementation (Go)

```go
import "encoding/json"

func CanonicalJSON(v any) ([]byte, error) {
    // encoding/json in Go already sorts map keys alphabetically.
    return json.Marshal(v)
}

func StableHash(v any) (string, error) {
    data, err := CanonicalJSON(v)
    if err != nil {
        return "", err
    }
    sum := sha256.Sum256(data)
    return hex.EncodeToString(sum[:]), nil
}
```

---

## Determinism Invariants (Enforced by Engine)

### 1. Instruction Ordering
All operations execute in a stable, predictable sequence. Parallelism is joined deterministically before any state is committed.

### 2. Stable Hashing
SHA-256 is the only hash algorithm used in fingerprint paths. MD5 and CRC are permitted only in non-persistent diagnostic contexts.

### 3. Canonical Time
- In strict (deterministic) mode, all timestamps are normalized to `0` (epoch zero).
- Wall-clock time may appear in human-readable log metadata but never in the fingerprint.
- Use `time.Unix(0, 0).UTC()` for epoch normalization in Go.

### 4. Stable IDs
Run IDs and artifact IDs are derived from content hashes. Random UUID generation is forbidden in fingerprint paths.

### 5. No Hidden State
- No reliance on uninitialized memory, race conditions, or environment variables not explicitly threaded through the execution context.
- Map iteration order is never used directly — always sort keys before hashing.

### 6. Floating-Point Exclusion
No float64 arithmetic in fingerprint paths. Use integer microseconds for durations.

---

## Entropy Injection Points (Forbidden in Production)

The following are illegal in any code path that reaches the fingerprint:

| Entropy Source | Why Forbidden | Mitigation |
| :--- | :--- | :--- |
| `time.Now()` | Non-deterministic wall clock | Use epoch zero in fingerprint paths |
| `rand.Int()` / `uuid.New()` | Non-deterministic random | Use content-hash-derived IDs |
| `map` iteration without sort | Go map iteration order is random | Always sort keys |
| `os.Getenv()` in hash path | Environment-dependent | Thread values explicitly |
| Concurrent goroutines joined by timestamp | Race condition | Join by logical order |

---

## Floating-Point & Math

- Avoid floating-point arithmetic in critical paths.
- Use fixed-point math (integer arithmetic with scaling) if required.
- If floating-point is unavoidable, use deterministic IEEE 754 operations and document the precision contract.

---

## Conformance Tests

Any engine implementation (Go, Rust, or other) must pass the conformance suite:

```bash
# Run golden fixture conformance tests (Go)
cd services/runner && go test ./internal/determinism/... -v

# Run Rust engine invariant tests
cargo test -p engine-core

# Run N=5 determinism stress test
reachctl verify-determinism --n=5
```

Golden fixtures are located in [`testdata/fixtures/conformance/`](../testdata/fixtures/conformance/).

---

## Related Documents

- [`docs/REPLAY_PROTOCOL.md`](REPLAY_PROTOCOL.md) — How runs are replayed for verification
- [`docs/REPLAY_INTEGRITY_PROOF.md`](REPLAY_INTEGRITY_PROOF.md) — Proof of execution integrity
- [`docs/STRESS_TESTING_MODEL.md`](STRESS_TESTING_MODEL.md) — Nondeterminism injection testing
- [`docs/DETERMINISM_DEBUGGING.md`](DETERMINISM_DEBUGGING.md) — How to debug divergences
