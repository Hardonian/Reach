# Example 01: Quickstart Local

**Purpose:** Minimal local run producing evidence output. This is the fastest way to see Reach in action.

**Level:** Beginner  
**Estimated Time:** 2 minutes

## Prerequisites

- Reach CLI installed (`reachctl` or `reach` in PATH)
- Node.js 18+ (for runner scripts)

## Quick Run

```bash
# Using the provided runner
node examples/01-quickstart-local/run.js

# Or manually with reach CLI
reach run examples/01-quickstart-local/pack.json --input examples/01-quickstart-local/seed.json
```

## What This Example Demonstrates

1. **Deterministic Execution** - Same input produces identical output hashes
2. **Evidence Collection** - Automatic capture of execution trace
3. **Fingerprint Generation** - SHA-256 hash of the event log
4. **Local-First Operation** - No cloud dependencies required

## Expected Output

```
=== Reach Quickstart ===
Input: {"action":"analyze","target":"infrastructure","priority":"medium"}
Run ID: run_<timestamp>
Status: completed
Fingerprint: <sha256-hash>
Evidence: 3 items collected
```

## Files

| File            | Purpose                                    |
| --------------- | ------------------------------------------ |
| `seed.json`     | Deterministic input payload                |
| `pack.json`     | Pack manifest defining the execution       |
| `run.js`        | One-command runner script                  |
| `expected.json` | Expected output structure for verification |

## What To Try Next

1. Modify `seed.json` and re-run - observe how the fingerprint changes
2. Run twice with same input - verify identical fingerprints
3. Try `reach explain <runId>` to see the execution trace
4. Move to [Example 02: Diff and Explain](../02-diff-and-explain/)

## Troubleshooting

**Issue:** `reach: command not found`  
**Fix:** Use `./reach` from repo root, or add to PATH

**Issue:** Run fails with policy error  
**Fix:** This example uses `strict-safe-mode` policy - check it's available in `policy-packs/`
