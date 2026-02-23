# Example 12: Replay-Only Validation

**Level:** Intermediate | **Time:** 2 min

Demonstrates replaying a capsule for deterministic validation without re-execution.

## What This Demonstrates

- Loading a previously exported capsule
- Validating capsule integrity
- Replaying events for verification
- Checking deterministic output parity

## Prerequisites

- Reach CLI installed
- A capsule file (`.capsule.json`)

## Running

```bash
# Using the example runner (creates demo capsule)
node examples/12-replay-only-validation/run.js

# Or manually with existing capsule
reach capsule replay my-run.capsule.json

# Verify first, then replay
reach capsule verify my-run.capsule.json
reach capsule replay my-run.capsule.json
```

## Expected Output

```
=== Reach Example 12: Replay-Only Validation ===

Step 1: Creating demo capsule...
✅ Capsule created: demo-run.capsule.json

Step 2: Verifying capsule integrity...
✅ Fingerprint verified
✅ Audit chain valid
✅ Event log intact

Step 3: Replaying for validation...
✅ Replay successful
✅ Steps replayed: 5
✅ Deterministic parity: PASSED

Validation complete! Replay matches original execution.
```

## Exit Codes

- `0` - Replay successful, parity verified
- `5` - Verification failed (output mismatch)
- `1` - Capsule corrupt or invalid

## How It Works

1. **Capsule Loading**: The capsule file is loaded and parsed
2. **Integrity Check**: The fingerprint and audit root are verified
3. **Event Replay**: Events are replayed through the deterministic engine
4. **Parity Check**: Output hash is compared to original

## Files

- `run.js` - Example runner that creates and replays capsule
- `sample-capsule.json` - Sample capsule for testing
