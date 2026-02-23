# Determinism Debugging Guide

Last Updated: 2026-02-22

## When to Use This Guide

Use this guide when:

- `reachctl replay` returns `REPLAY_DIVERGED`
- `reachctl verify-determinism` finds mismatched fingerprints
- CI reports a determinism violation
- Two runs of the same pack produce different fingerprints

---

## Step 1 — Identify the Divergence

Run the diff command to pinpoint the first divergence:

```bash
reachctl diff-run <run-id-A> <run-id-B> --json
```

Look for the `first_divergent_event_index` field in the output. The divergence is always at a specific event in the ordered event log.

**Common divergence locations:**

| Location                  | Likely Cause                                  |
| :------------------------ | :-------------------------------------------- |
| `event_log_hash` mismatch | Event ordering, missing event, or extra event |
| `output_hash` mismatch    | Non-deterministic output generation           |
| `fingerprint` mismatch    | Any of the above, or engine version change    |
| `input_hash` mismatch     | Inputs were modified (not a true divergence)  |

---

## Step 2 — Examine the Divergent Event

Extract and compare the raw event logs:

```bash
# Export both runs
reachctl export <run-id-A> --output run-A.reach.zip
reachctl export <run-id-B> --output run-B.reach.zip

# Unzip and diff the event logs
unzip run-A.reach.zip logs/events.ndjson -d run-A/
unzip run-B.reach.zip logs/events.ndjson -d run-B/

diff run-A/logs/events.ndjson run-B/logs/events.ndjson
```

---

## Step 3 — Common Root Causes

### Cause 1: Map Iteration Order (Go)

**Symptom**: Event log contains JSON with keys in different orders between runs.

**Diagnosis**: Look for any `map` iteration in Go code that feeds directly into event construction or hash generation.

**Fix**: Always sort map keys before serialization. Use `CanonicalJSON()` from the determinism package.

```go
// BAD: map iteration order is random in Go
for k, v := range myMap {
    events = append(events, fmt.Sprintf("%s: %s", k, v))
}

// GOOD: sort keys first
keys := make([]string, 0, len(myMap))
for k := range myMap {
    keys = append(keys, k)
}
sort.Strings(keys)
for _, k := range keys {
    events = append(events, fmt.Sprintf("%s: %s", k, myMap[k]))
}
```

---

### Cause 2: Wall-Clock Timestamps

**Symptom**: Events contain timestamps that differ between runs.

**Diagnosis**: Search for `time.Now()` in event construction code.

**Fix**: Pass a deterministic "virtual time" through the execution context. In fingerprint paths, use `time.Unix(0, 0).UTC()`.

```go
// BAD
event := Event{Timestamp: time.Now()}

// GOOD
event := Event{Timestamp: ctx.DeterministicTime()} // returns epoch zero
```

---

### Cause 3: Concurrent Goroutine Race

**Symptom**: Events appear in different orders between runs, even though the same code path is followed.

**Diagnosis**: Look for goroutines that write to a shared event channel or slice without synchronization.

**Fix**: Join all goroutines before finalizing the event log. The join order must be deterministic (by logical sequence, not by goroutine completion time).

---

### Cause 4: Non-Deterministic Tool Response

**Symptom**: `tool.responded` events have different payloads between runs.

**Diagnosis**: The tool may be returning non-deterministic data (e.g., current time, random IDs, unordered lists).

**Fix**: For types that can return non-deterministic data:

1. Record the raw response and normalize it before hashing.
2. Sort arrays in tool responses if order is semantically irrelevant.
3. Document that the tool is non-deterministic and assert it is NOT replay-safe.

---

### Cause 5: Environment Variable Leakage

**Symptom**: Different results on different machines despite identical inputs.

**Diagnosis**: Check if any code reads from `os.Getenv()` in the execution path.

**Fix**: All environment variables used by the engine must be explicitly passed through the `ExecutionContext`. They must appear in `input_hash`.

---

### Cause 6: Engine Version Mismatch

**Symptom**: Replay fails with `RL-2003 EngineVersionMismatch`.

**Diagnosis**: The engine binary version doesn't match `engine_version` in the run manifest.

**Fix**: Install the correct engine version matching the run's manifest. Use `reachctl version` to check.

---

## Step 4 — Verify the Fix

After applying a fix:

```bash
# Run N=5 determinism verification
reachctl verify-determinism --n=5

# If it passes, run the conformance suite
cd services/runner && go test ./internal/determinism/... -v
```

Both must pass before the fix can be merged.

---

## Step 5 — Add a Regression Test

Every determinism bug should have a corresponding test case:

1. Create a fixture in `testdata/fixtures/conformance/` documenting the scenario.
2. Add a test in `services/runner/internal/determinism/` that exercises the fix.
3. Update `testdata/stress/` with a scenario that injects the root cause.

---

## Escalation Path

If the root cause cannot be identified:

1. Document the divergence in `docs/OSS_FIRST_PIVOT_PLAN.md` under the relevant phase.
2. Open an issue with label `determinism-violation`.
3. Attach the raw export of both diverging runs (`reachctl export`).
4. Do NOT merge determinism-breaking code until the root cause is identified.

---

## Related Documents

- [`docs/DETERMINISM_SPEC.md`](DETERMINISM_SPEC.md) — Invariant rules
- [`docs/REPLAY_PROTOCOL.md`](REPLAY_PROTOCOL.md) — How replay works
- [`docs/REPLAY_DIFF_SPEC.md`](REPLAY_DIFF_SPEC.md) — diff-run output format
- [`docs/STRESS_TESTING_MODEL.md`](STRESS_TESTING_MODEL.md) — Injecting nondeterminism in tests
