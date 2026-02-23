# Trust Model

Last Updated: 2026-02-23

## Purpose

This document formalizes the trust model of the Reach system — how
cryptographic integrity is established, verified, and maintained across
all system boundaries. It builds on the existing threat model
(`docs/threat-model.md`) to provide implementation-specific guarantees.

---

## 1. Hash Chain Architecture

### Chain Structure

The hash chain is the primary integrity mechanism. Each layer of the system
produces a hash that chains to the next:

```text
Input Hash ──→ Event Log Hash ──→ Output Hash ──→ Fingerprint
    │                │                  │               │
    │                │                  │               ▼
    │                │                  │         runs.fingerprint
    │                │                  ▼
    │                │            transcript.transcript_hash
    │                ▼
    │          (implicit: events are ordered by auto-increment ID)
    ▼
  hashInput(spec, evidence, dependsOn, informs)
```

### Hash Contributors

| Hash              | What It Covers                             | Algorithm |
| :---------------- | :----------------------------------------- | :-------- |
| `inputHash`       | Spec + evidence + dependency graph         | SHA-256   |
| `outputHash`      | Engine evaluation result                   | SHA-256   |
| `transcript_hash` | Full transcript including inputs + outputs | SHA-256   |
| `pipelineHash`    | Combined hash of input + output + pipeline | SHA-256   |
| `chainHash`       | Cumulative chain across runs               | SHA-256   |
| `fingerprint`     | Final run-level integrity marker           | SHA-256   |

### Hashing Implementation

| Language   | Function                                        | Notes                    |
| :--------- | :---------------------------------------------- | :----------------------- |
| TypeScript | `hashString()`, `HashStream`, `combineHashes()` | `node:crypto` SHA-256    |
| Go         | `Hash()`, `CanonicalJSON()`                     | `crypto/sha256`          |
| Rust       | `canonical_hash()`                              | FNV-1a (replay hot path) |

---

## 2. Hash Chain Completeness

### What Is Covered

| Component             | Hashed  | Verified on Replay | Notes                                                |
| :-------------------- | :------ | :----------------- | :--------------------------------------------------- |
| Decision spec         | YES     | YES                | Part of `inputHash`                                  |
| Evidence events       | YES     | YES                | Part of `inputHash`                                  |
| Dependency graph      | YES     | YES                | `dependsOn` + `informs`                              |
| Engine output         | YES     | YES                | `outputHash`                                         |
| Event log ordering    | YES     | YES                | By auto-increment ID                                 |
| Transcript metadata   | YES     | YES                | `transcript_hash`                                    |
| Plugin output         | NO      | NO                 | Gap: see Risk section                                |
| Artifact blob content | PARTIAL | NO                 | `content_hash` in sqlite.go schema but not populated |
| Timestamps            | NO      | NO                 | Excluded from hash by design                         |

### Gap: Artifact Content Hash

The `artifacts` table in `sqlite.go` has a `content_hash TEXT` column, but the
`Write()` method does not populate it. This means blob integrity is not
verified on read.

**Recommendation**: Populate `content_hash` with SHA-256 of the blob data
during `Write()`, and verify on `Read()`.

### Gap: Plugin Output Hashing

Plugin outputs (from WASM/JS sandboxed execution) are not included in the
hash chain. A malicious plugin could return different output on replay.

**Mitigation**: The existing threat model requires plugins to be sandboxed
and capability-registered. For v0.1, plugin output hashing is deferred as
plugins are not yet used in production paths.

---

## 3. Export Bundle Integrity

### Bundle Structure

Export bundles (`.reach.zip`) contain:

- `logs/events.ndjson` — the event log
- Transcript metadata
- The canonical fingerprint

### Integrity on Export

The export process:

1. Serializes all events to NDJSON.
2. Includes the `transcript_hash` in the bundle.
3. Optionally signs the bundle (Ed25519 envelope).

### Integrity on Import

The import process:

1. Extracts the events.
2. Replays them to compute the hash.
3. Compares with the embedded `transcript_hash`.
4. If signed, verifies the Ed25519 signature against the keyring.

### Envelope Signing

```typescript
// Create unsigned envelope
const envelope = createEnvelope(transcript, metadata);

// Sign with Ed25519
const signed = signEnvelopeWithEd25519(envelope, keyPath, "ed25519");

// Verify
const result = verifyEnvelope(signed, pubKeyPem);
// result.ok === true && result.signerFingerprints.length > 0
```

### Chain Verification

```typescript
const result = verifyTranscriptChain(envelopes);
// result.ok === true, result.chain_length === envelopes.length
```

**Current State**: `verifyTranscriptChain()` returns `{ ok: true }` without
actually verifying inter-transcript hash links. This is a stub.

**Risk Level**: MEDIUM. The function exists and returns the correct interface,
but does not enforce chain integrity across multiple transcripts.

**Recommendation**: Implement actual chain verification — each transcript's
`dependsOn` hashes should be checked against the previous transcripts' hashes.

---

## 4. Verify Command Coverage

### Available Verify Commands

| Command                       | What It Verifies                 | Status |
| :---------------------------- | :------------------------------- | :----- |
| `reachctl replay`             | Replay produces same fingerprint | REAL   |
| `reachctl diff-run`           | Two runs compared structurally   | REAL   |
| `reachctl verify-determinism` | N-trial hash comparison          | REAL   |
| `reachctl proof`              | Envelope signature verification  | REAL   |
| `reachctl explain`            | Human-readable run explanation   | REAL   |
| `reachctl trace`              | Step-by-step execution trace     | REAL   |
| `zeo verify_transcript`       | Transcript hash verification     | REAL   |

### What Is NOT Verified

| Gap                         | Risk                                     |
| :-------------------------- | :--------------------------------------- |
| Cross-language hash match   | TS and Go could produce different hashes |
| Artifact blob integrity     | Blobs not hash-verified on read          |
| Plugin output replay safety | No hash for plugin outputs               |
| Chain continuity            | `verifyTranscriptChain` is a stub        |
| Snapshot state integrity    | No hash on snapshot `state_payload`      |

---

## 5. Tamper Edge Cases

### Edge Case 1: Direct SQLite Modification

**Attack**: Attacker modifies the `events` table directly, changing a payload.

**Detection**: Replay will produce a different fingerprint. The `reachctl replay`
command detects this.

**Gap**: If the attacker also modifies `runs.fingerprint` to match the new
payload, the replay will "pass". This is why signed envelopes exist — the
envelope signature covers the transcript hash, which cannot be forged without
the private key.

### Edge Case 2: Event Insertion

**Attack**: Attacker inserts a new event between existing events.

**Detection**: The auto-increment ID breaks the sequence. Replay will include
the extra event and produce a different hash.

**Mitigation**: The event store's ID monotonicity invariant detects insertions.

### Edge Case 3: Event Deletion

**Attack**: Attacker deletes an event from the log.

**Detection**: Replay will be missing an event, producing a different hash.

**Gap**: If the deleted event was pruned (legitimately), the detection depends
on snapshot coverage. Ensure pruning is always accompanied by snapshots.

### Edge Case 4: Snapshot Manipulation

**Attack**: Attacker modifies the `state_payload` in the `snapshots` table.

**Detection**: Resumable replay from the modified snapshot will produce a
different final hash than full replay.

**Gap**: Currently, snapshot `state_payload` is not independently hashed.
Adding a `state_hash` column to the snapshots table would allow fast
integrity checks without full re-replay.

### Edge Case 5: Clock Manipulation

**Attack**: Attacker sets system clock to a different time to alter timestamp-
dependent logic.

**Detection**: Timestamps are excluded from the hash chain by design. Clock
manipulation does not affect deterministic output.

**Residual Risk**: The `addedAt` field in keyring entries uses `resolveTimestamp()`.
If the clock is manipulated, the keyring entry will have a wrong timestamp.
This is informational only and does not affect cryptographic verification.

---

## 6. Formal Invariants

| ID     | Invariant                                              | Status   |
| :----- | :----------------------------------------------------- | :------- |
| TRU-01 | Replay detects any event modification                  | HOLDS    |
| TRU-02 | Replay detects event insertion                         | HOLDS    |
| TRU-03 | Replay detects event deletion                          | HOLDS    |
| TRU-04 | Envelope signature covers transcript hash              | HOLDS    |
| TRU-05 | Keyring tracks signer fingerprints                     | HOLDS    |
| TRU-06 | Clock manipulation does not affect hash chain          | HOLDS    |
| TRU-07 | Artifact blobs are integrity-verified on read          | **NO**   |
| TRU-08 | Transcript chain is verified across envelopes          | **STUB** |
| TRU-09 | Snapshot state is integrity-verified                   | **NO**   |
| TRU-10 | `runs.fingerprint` + `events` can be tampered together | RISK     |
