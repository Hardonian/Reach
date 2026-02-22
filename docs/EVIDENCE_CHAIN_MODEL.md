# Evidence Chain Model

Last Updated: 2026-02-22 (Extended for Governance + Cryptographic Signing)

## Purpose

The Evidence Chain is a cryptographically linked sequence of execution artifacts that together prove the integrity and determinism of a Reach run. It enables any party to independently verify that an execution was correct, unmodified, and produced by the declared engine and policy.

---

## Chain Structure

A run's Evidence Chain is a four-stage pipeline:

```text
[Input]
  input_hash = SHA-256(canonical_JSON(inputs))
      │
      ▼
[Policy]
  policy_version = SHA-256(policy_bundle_json)
  gate_verdict = ALLOW | DENY
      │
      ▼
[Artifacts]
  artifact_hashes = [SHA-256(a) for a in artifacts]
      │    ← sorted by artifact ID
      ▼
[Execution]
  event_log_hash = SHA-256(events.ndjson_bytes)
      │    ← ordered by insertion sequence
      ▼
[Output]
  output_hash = SHA-256(canonical_JSON(outputs))
      │
      ▼
[Fingerprint]
  fingerprint = SHA-256(run_id || engine_version || event_log_hash)
```

---

## Stage Definitions

### Stage 1: Input

- The raw data provided to the execution, canonicalized.
- `input_hash = SHA-256(canonical_JSON({sorted_keys: true, values: inputs}))`
- This hash is part of the `run_id` derivation, so different inputs produce different run IDs.

### Stage 2: Policy

- The governing rules bundle applied to the execution.
- `policy_version = SHA-256(policy_bundle_json)`
- Policy gates are evaluated before execution begins and at each tool call.
- Gate verdict (`ALLOW`/`DENY`) is recorded in the event log.

### Stage 3: Artifacts

- All versioned dependencies and environment state used during the run.
- Each artifact (pack, tool, library) is individually hashed.
- `artifact_hashes` is a sorted array, so adding/removing/changing any artifact changes this field.

### Stage 4: Execution + Output

- The complete ordered event log records every state transition.
- `event_log_hash = SHA-256(NDJSON_bytes_of_ordered_events)`
- `output_hash = SHA-256(canonical_JSON(final_outputs))`
- The fingerprint is the final chain proof.

---

## Immutable Linkage Property

Each stage's output feeds the next:

- `run_id` depends on `input_hash` + `policy_version` + sequence
- `fingerprint` depends on `run_id` + `engine_version` + `event_log_hash`
- `event_log_hash` depends on the complete ordered event stream, which includes artifact responses

This means: **changing any stage changes all downstream values**.

---

## Evidence Chain in the UI

The playground (`apps/arcade`) shows the Evidence Chain visualization for any completed run:

```text
Input  ─────────────────────────────────── sha256:2c6242...
 │  Policy (strict-default)                sha256:aabb12...
 │   ALLOW ✓
 ▼  Artifacts (1)                          sha256:ef5678...
    Events (9 total)                        sha256:9f86d0...
 ▼  Output                                 sha256:4b4da8...
    Fingerprint                             sha256:7a8b9c...  ✓ VERIFIED
```

Each value is clickable to inspect the raw artifact content.

---

## Verification

```bash
# Verify the evidence chain of a stored run
reachctl replay <run-id> --json

# Export the full chain for external audit
reachctl export <run-id> --output ./evidence-bundle.reach.zip
```

The exported bundle contains all chain components for independent verification.

---

## New Feature Requirements

Per the [AGENTS.md](../AGENTS.md) Evidence-First principle:

> All new execution features must include a corresponding update to the Evidence Chain model.

Specifically, any new feature that:

1. Adds a new type of artifact → must add to `artifact_hashes`
2. Adds a new event type → must add to the event schema in `protocol/schemas/events.schema.json`
3. Changes state that feeds the fingerprint → must update this document and `docs/DETERMINISM_SPEC.md`

---

## Related Documents

- [`docs/DETERMINISM_SPEC.md`](DETERMINISM_SPEC.md) — Hash construction rules
- [`docs/REPLAY_INTEGRITY_PROOF.md`](REPLAY_INTEGRITY_PROOF.md) — Formal integrity proof
- [`docs/POLICY_ENGINE_SPEC.md`](POLICY_ENGINE_SPEC.md) — Policy evaluation model
- [`protocol/schemas/events.schema.json`](../protocol/schemas/events.schema.json) — Event schema
