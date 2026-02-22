# Replay Protocol — Reach V1

Last Updated: 2026-02-22

## Objective

The Replay Protocol allows any authorized party to verify the validity of a past execution by re-running it from its stored event log and comparing the resulting fingerprint. A successful replay provides cryptographic proof that the original execution was deterministic and unmodified.

---

## Replay Inputs

A complete replay requires the following artifacts (all stored locally at `~/.reach/runs/<run_id>/`):

| Artifact | Path | Description |
| :--- | :--- | :--- |
| Run manifest | `meta.json` | Contains `run_id`, `engine_version`, `policy_version`, `input_hash`, `fingerprint` |
| Execution pack | `artifacts/pack.zip` | The exact pack version used in the original run |
| Input state | `artifacts/inputs.json` | Canonical-JSON serialization of all inputs |
| Event log | `logs/events.ndjson` | Ordered NDJSON stream of all execution events |
| Policy bundle | `artifacts/policy.json` | The policy bundle version used |

---

## Replay Algorithm

```
1. Load meta.json → extract original_fingerprint
2. Load events.ndjson → build event_log[]
3. Re-initialize engine at engine_version from meta.json
4. Load policy at policy_version from meta.json
5. Re-execute all events in insertion order:
   - For each event: apply state transition deterministically
   - Do NOT re-invoke external tool calls (replay uses stored tool responses)
6. Compute replay_fingerprint = SHA-256(run_id || engine_version || SHA-256(event_log_ndjson))
7. Compare: replay_fingerprint == original_fingerprint
8. Return REPLAY_VERIFIED or REPLAY_DIVERGED
```

---

## Comparison Rules

A replay is **VERIFIED** if and only if all of the following hold:

| Condition | Check |
| :--- | :--- |
| Fingerprint match | `replay_fingerprint == original_fingerprint` |
| Event count match | `len(replay_events) == len(original_events)` |
| Event log hash match | `SHA-256(replay_events_ndjson) == event_log_hash` |
| Output hash match | `SHA-256(canonical_outputs) == output_hash` |
| Artifact hash match | All `artifact_hashes` from manifest match re-computed values |

A single mismatch results in `REPLAY_DIVERGED` with the first divergent field identified.

---

## Replay Commands

```bash
# Replay a stored run
reachctl replay <run-id>

# Replay with verbose diff output on divergence
reachctl replay <run-id> --verbose

# Machine-readable replay result
reachctl replay <run-id> --json

# Verify determinism by running same pack N times
reachctl verify-determinism --n=5 --pack demo-pack

# Compare two existing runs
reachctl diff-run <run-id-A> <run-id-B>
```

---

## Replay Output (JSON)

```json
{
  "run_id": "abc123",
  "status": "REPLAY_VERIFIED",
  "original_fingerprint": "sha256:aabbcc...",
  "replay_fingerprint":  "sha256:aabbcc...",
  "match": true,
  "duration_ms": 42,
  "events_replayed": 17,
  "divergence": null
}
```

On divergence:

```json
{
  "run_id": "abc123",
  "status": "REPLAY_DIVERGED",
  "original_fingerprint": "sha256:aabbcc...",
  "replay_fingerprint":  "sha256:xxyyzz...",
  "match": false,
  "divergence": {
    "field": "event_log_hash",
    "expected": "sha256:aabbcc...",
    "got":      "sha256:xxyyzz...",
    "first_divergent_event_index": 5
  }
}
```

---

## Failure Modes

| Failure | Code | Description | Resolution |
| :--- | :--- | :--- | :--- |
| Fingerprint mismatch | `RL-2001` | Replay hash doesn't match original. Possible engine drift or tampered log. | Run `reachctl diff-run` to identify divergence. Check engine version. |
| Missing artifacts | `RL-3001` | Required artifacts not found in data dir. | Re-export and re-import the capsule. |
| Engine version mismatch | `RL-2003` | Engine binary doesn't match `engine_version` in manifest. | Install the correct engine version. |
| Timeout | `RL-2004` | Replay did not complete within time constraints. | Increase timeout with `--timeout=120s`. |
| Policy version mismatch | `RL-1003` | Policy bundle hash doesn't match original. | Policy may have changed. Re-import the policy bundle. |

---

## Deterministic Replay Guarantee

The Replay Protocol is only valid when the engine version and policy version match the original run. Changes to either will produce a new fingerprint regardless of input identity. This is by design — replay proves that the **same version of the system** produces identical outputs, not that fundamentally different versions agree.

---

## Related Documents

- [`docs/DETERMINISM_SPEC.md`](DETERMINISM_SPEC.md) — Canonical run model and invariants
- [`docs/REPLAY_INTEGRITY_PROOF.md`](REPLAY_INTEGRITY_PROOF.md) — Formal proof of replay integrity
- [`docs/REPLAY_DIFF_SPEC.md`](REPLAY_DIFF_SPEC.md) — Run comparison diff format
- [`docs/DETERMINISM_DEBUGGING.md`](DETERMINISM_DEBUGGING.md) — Debugging replay divergences
