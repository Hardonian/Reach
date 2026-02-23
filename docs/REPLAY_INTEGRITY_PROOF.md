# Replay Integrity Proof

Last Updated: 2026-02-22

## Purpose

This document formalizes the cryptographic proof that Reach run replay is integrity-preserving — meaning that a successful replay provides strong evidence that:

1. The original execution was deterministic.
2. The event log has not been tampered with.
3. The output was produced by the declared engine and policy versions.

---

## Proof Model

### Definitions

Let:

- `I` = canonical-JSON serialization of all run inputs (sorted keys)
- `P` = SHA-256 of the policy bundle
- `A` = sorted array of SHA-256 hashes of all artifacts
- `E` = ordered NDJSON stream of execution events
- `O` = canonical-JSON serialization of all run outputs
- `V` = engine version string (semver)
- `R` = `run_id` (derived from `SHA-256(I || P || sequence)`)

### Fingerprint Construction

```
input_hash      := SHA-256(I)
policy_version  := P  (= SHA-256(policy_bundle))
artifact_hashes := [SHA-256(a) for a in A]  (sorted)
event_log_hash  := SHA-256(NDJSON_bytes(E))
output_hash     := SHA-256(O)

fingerprint     := SHA-256(R || V || event_log_hash)
```

### Integrity Theorem

> **If** `fingerprint_original == fingerprint_replay`
> **Then** with SHA-256 collision resistance, the following hold:
>
> 1. `R_replay == R_original` (same run_id → same inputs and policy)
> 2. `V_replay == V_original` (same engine version)
> 3. `event_log_hash_replay == event_log_hash_original` (same event log)
> 4. Since the engine is deterministic, identical inputs + event log → identical outputs

This forms a complete proof chain: **fingerprint equality implies execution equivalence**.

---

## Evidence Chain

The integrity proof corresponds to the Evidence Chain model (see [`docs/EVIDENCE_CHAIN_MODEL.md`](EVIDENCE_CHAIN_MODEL.md)):

```
[Input: I]
    │  input_hash = SHA-256(I)
    ▼
[Policy: P]
    │  policy_version = SHA-256(policy_bundle)
    ▼
[Artifacts: A]
    │  artifact_hashes = [SHA-256(a) for a in artifacts]
    ▼
[Execution: E]
    │  event_log_hash = SHA-256(events.ndjson)
    ▼
[Output: O]
    │  output_hash = SHA-256(O)
    ▼
[Fingerprint]
    SHA-256(run_id || engine_version || event_log_hash)
```

Each stage's hash depends on the previous stage's outputs, forming a cryptographic chain.

---

## Tamper Detection

The proof model detects the following tampering vectors:

| Attack Vector                  | Detection Method                                                     |
| :----------------------------- | :------------------------------------------------------------------- |
| Modified input data            | `input_hash` mismatch → `run_id` mismatch → fingerprint mismatch     |
| Modified policy                | `policy_version` mismatch → `run_id` mismatch → fingerprint mismatch |
| Injected/deleted events in log | `event_log_hash` mismatch → fingerprint mismatch                     |
| Modified outputs               | `output_hash` mismatch (independently verifiable)                    |
| Engine version substitution    | `engine_version` mismatch → fingerprint mismatch                     |
| Artifact tampering             | `artifact_hashes` array mismatch                                     |

---

## Verification Commands

```bash
# Verify a single run's replay integrity
reachctl replay <run-id> --json

# Verify fingerprint directly without full replay
reachctl verify-fingerprint <run-id>

# Batch verify N runs (stress test determinism)
reachctl verify-determinism --n=5
```

---

## Limitations

1. **Engine version pinning**: The proof holds only when the same engine version is used for replay. A different engine version may produce different results legitimately.
2. **Tool response determinism**: External tool responses are stored and replayed from the event log. The proof does not cover the external tool's behavior — only that the stored responses are used consistently.
3. **Policy changes**: If the policy bundle is updated, a replay against the new policy will have a different fingerprint. This is expected and documented.
4. **Hash collision resistance**: The proof relies on SHA-256 collision resistance. While SHA-256 is currently secure, any future collision attack would weaken the integrity guarantees.

---

## Golden Fixture Verification

The conformance tests in [`testdata/fixtures/conformance/`](../testdata/fixtures/conformance/) validate that the proof model holds across engine implementations:

```bash
cd services/runner && go test ./internal/determinism/... -run TestConformance -v
```

Each fixture contains a pre-computed `fingerprint` that must be reproduced exactly by any conforming engine implementation.
