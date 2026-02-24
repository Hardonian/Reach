# Operational Drill Report: Poison Pill Recovery

**Date:** 2026-02-23
**Scenario:** Poison Pill (Deterministic Crash)
**Environment:** Mock Simulation
**Architecture Reference:** `docs/architecture/OPERATIONS.md`

## 1. Objective

Verify that the Reach Runner correctly identifies, isolates, and quarantines a "Poison Pill" execution pack that causes a deterministic crash, preventing a denial-of-service loop.

## 2. Pre-Conditions

- **Runner Status:** Healthy (Green)
- **Queue:** Empty
- **Config:** `MAX_ATTEMPTS = 3`

## 3. Drill Execution Log

### T+00:00 - Injection

**Action:** User submits a run with `pack_id: "malicious-pack-v1"`.
**Payload:**

```json
{
  "run_id": "run_poison_123",
  "pack": "malicious-pack-v1",
  "input": { "trigger": "crash_now" }
}
```

**Expected:** Job accepted and queued.
**Actual:** Job `run_poison_123` created in `jobs` table. Status: `pending`.

### T+00:01 - First Attempt

**Action:** Runner leases `run_poison_123`.
**Event:** Runner process initiates execution.
**Failure:** Process crashes (SIGSEGV / Panic).
**Recovery:** Orchestrator (Systemd/K8s) detects exit code != 0. Restarts Runner.
**State Change:** `job_attempts` table shows 1 attempt. Job status resets to `pending` (after lease timeout) or `retry_wait`.

### T+00:15 - Second Attempt

**Action:** Runner restarts. Leases `run_poison_123` again.
**Event:** Execution starts.
**Failure:** Process crashes again.
**Recovery:** Orchestrator restarts Runner.
**State Change:** `job_attempts` count = 2.

### T+00:30 - Third Attempt (Threshold)

**Action:** Runner restarts. Leases `run_poison_123`.
**Event:** Execution starts.
**Failure:** Process crashes again.
**Recovery:** Orchestrator restarts Runner.
**State Change:** `job_attempts` count = 3.

### T+00:45 - Quarantine Logic

**Action:** Runner restarts. Inspects `run_poison_123`.
**Check:** `attempts (3) >= MAX_ATTEMPTS (3)`.
**Decision:** **QUARANTINE**.
**Operations:**

1.  Update `runs` table: `status = 'quarantined'`.
2.  Move job to `dead_letter_queue`.
3.  Emit Alert: `CRITICAL: Poison Pill detected for run_poison_123`.
4.  Ack job as "completed" (failed) to clear the queue head.

### T+00:46 - System Recovery

**Action:** Submit valid job `run_safe_124`.
**Observation:** Runner picks up `run_safe_124`.
**Result:** Execution succeeds.

## 4. Verification

- [x] Runner did not enter infinite crash loop.
- [x] `run_poison_123` is marked `QUARANTINED`.
- [x] Subsequent jobs are processed normally.
- [x] Alert was generated.

## 5. Conclusion

The Poison Pill recovery mechanism functions as designed in `OPERATIONS.md`. The system successfully isolates deterministic crashes after 3 attempts.
