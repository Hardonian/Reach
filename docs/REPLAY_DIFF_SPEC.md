# Replay Diff Specification

Last Updated: 2026-02-22

## Purpose

Defines the output format for `reachctl diff-run <run-id-A> <run-id-B>`, which compares two run fingerprints and produces a structured diff for determinism debugging.

---

## Command

```bash
reachctl diff-run <run-id-A> <run-id-B> [--json] [--verbose]
```

---

## Output Format

### Human-Readable

```
diff-run <run-id-A> <run-id-B>
══════════════════════════════════════════════════════
  run_id:          match ✓
  engine_version:  match ✓
  policy_version:  match ✓
  input_hash:      match ✓
  artifact_hashes: match ✓
  event_log_hash:  MISMATCH ✗
    A: sha256:aabbcc...
    B: sha256:xxyyzz...
  output_hash:     MISMATCH ✗
  fingerprint:     MISMATCH ✗

──────────────────────────────────────────────────────
  First divergent event: #5

  Event #5 in A:
    {"seq":5,"type":"tool.responded","tool":"list","output":{"items":["a","b","c"]}}

  Event #5 in B:
    {"seq":5,"type":"tool.responded","tool":"list","output":{"items":["c","a","b"]}}

──────────────────────────────────────────────────────
  Diagnosis: tool response array order is non-deterministic
  Suggestion: Sort tool response arrays before inclusion in event log.
  Error code: RL-2001
```

---

## JSON Output Schema

```json
{
  "run_id_a": "sha256:...",
  "run_id_b": "sha256:...",
  "overall": "MISMATCH",
  "fields": {
    "run_id": { "match": true, "a": "...", "b": "..." },
    "engine_version": { "match": true, "a": "0.2.0", "b": "0.2.0" },
    "policy_version": { "match": true, "a": "...", "b": "..." },
    "input_hash": { "match": true, "a": "...", "b": "..." },
    "artifact_hashes": { "match": true, "a": ["..."], "b": ["..."] },
    "event_log_hash": {
      "match": false,
      "a": "sha256:aabbcc",
      "b": "sha256:xxyyzz"
    },
    "output_hash": {
      "match": false,
      "a": "sha256:def456",
      "b": "sha256:fedcba"
    },
    "fingerprint": {
      "match": false,
      "a": "sha256:111222",
      "b": "sha256:999888"
    }
  },
  "event_diff": {
    "total_events_a": 10,
    "total_events_b": 10,
    "first_divergent_index": 5,
    "event_a": {
      "seq": 5,
      "type": "tool.responded",
      "tool": "list",
      "output": { "items": ["a", "b", "c"] }
    },
    "event_b": {
      "seq": 5,
      "type": "tool.responded",
      "tool": "list",
      "output": { "items": ["c", "a", "b"] }
    }
  },
  "diagnosis": {
    "probable_cause": "tool_response_order_nondeterministic",
    "suggestion": "Sort tool response arrays before inclusion in event log.",
    "error_code": "RL-2001",
    "see_also": "docs/DETERMINISM_DEBUGGING.md#cause-3-non-deterministic-tool-response"
  }
}
```

---

## Diff Fields

| Field             | Match Semantics                                                 |
| :---------------- | :-------------------------------------------------------------- |
| `run_id`          | Should always match for identical inputs + policy               |
| `engine_version`  | Must match for replay to be valid                               |
| `policy_version`  | Must match for identical policy evaluation                      |
| `input_hash`      | Hash of all inputs. Mismatch = different inputs fed             |
| `artifact_hashes` | Sorted array of artifact hashes. Mismatch = different artifacts |
| `event_log_hash`  | Hash of the complete ordered event log NDJSON                   |
| `output_hash`     | Hash of canonical-JSON outputs                                  |
| `fingerprint`     | Final proof. Mismatch = some invariant was violated             |

---

## Diagnosis Heuristics

When an event log mismatch is detected, the diff engine attempts automatic diagnosis:

| Detected Pattern                                     | Probable Cause                      | Code                      |
| :--------------------------------------------------- | :---------------------------------- | :------------------------ |
| Same event count, first event differs in key-order   | Map iteration order                 | `map-iteration`           |
| Same event count, first event differs in array order | Array sort not stable               | `array-order`             |
| Event counts differ                                  | Missing or extra event              | `event-count-mismatch`    |
| `event_log_hash` identical but `output_hash` differs | Output generation non-deterministic | `output-nondeterministic` |
| All hashes match except `fingerprint`                | Engine version string difference    | `engine-version`          |

---

## Exit Codes

| Exit Code | Meaning                                |
| :-------- | :------------------------------------- |
| `0`       | All fields match (no difference)       |
| `1`       | One or more fields differ (`MISMATCH`) |
| `2`       | One or both run IDs not found          |
| `3`       | Internal error                         |

---

## Related Documents

- [`docs/DETERMINISM_DEBUGGING.md`](DETERMINISM_DEBUGGING.md) — Root cause analysis guide
- [`docs/REPLAY_PROTOCOL.md`](REPLAY_PROTOCOL.md) — Replay algorithm
- [`docs/DETERMINISM_SPEC.md`](DETERMINISM_SPEC.md) — Invariant rules
- [`docs/CLI_REFERENCE.md`](CLI_REFERENCE.md) — `reachctl diff-run` usage
