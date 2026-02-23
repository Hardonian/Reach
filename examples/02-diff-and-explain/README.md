# Example 02: Diff and Explain

**Purpose:** Create two runs, generate diff-run, show explain output. Learn how Reach tracks changes across executions.

**Level:** Beginner  
**Estimated Time:** 3 minutes

## Prerequisites

- Reach CLI installed
- Completion of Example 01 (understanding of basic run)

## Quick Run

```bash
# Run the complete demo
node examples/02-diff-and-explain/run.js

# Or step by step:
# 1. Create first run
reach run examples/02-diff-and-explain/pack.json \
  --input examples/02-diff-and-explain/seed-v1.json \
  --tag baseline

# 2. Create second run (modified input)
reach run examples/02-diff-and-explain/pack.json \
  --input examples/02-diff-and-explain/seed-v2.json \
  --tag modified

# 3. Compare runs
reach diff-run <run-id-1> <run-id-2>

# 4. Explain differences
reach explain <run-id-2> --compare <run-id-1>
```

## What This Example Demonstrates

1. **Change Detection** - Automatic diff between two executions
2. **Input Tracking** - How input changes affect outputs
3. **Explainability** - Natural language explanation of differences
4. **Run Tagging** - Organizing runs for comparison

## Expected Output

```
=== Reach Diff Analysis ===
Run A (baseline): run_abc123
Run B (modified): run_def456

Input Differences:
  + metrics.cpu_utilization: 45.2 → 78.5
  + resources[0].status: "running" → "degraded"

Output Differences:
  + recommendation.priority: "low" → "high"
  + action_required: false → true

Fingerprint Delta: <diff-hash>
```

## Files

| File                 | Purpose                       |
| -------------------- | ----------------------------- |
| `seed-v1.json`       | Baseline input (stable state) |
| `seed-v2.json`       | Modified input (alert state)  |
| `pack.json`          | Pack manifest                 |
| `run.js`             | Automated two-run demo        |
| `expected-diff.json` | Expected difference structure |

## Scenarios Covered

### Scenario 1: Infrastructure Degradation

- V1: Healthy infrastructure (45% CPU, running)
- V2: Degraded infrastructure (78% CPU, alerts)
- Diff: Shows escalation from monitoring to action

### Scenario 2: Configuration Drift

- Input context changes between runs
- Policy evaluation differences
- Evidence chain variations

## What To Try Next

1. Create a third run with emergency-level metrics
2. Use `reach diff-run` across all three
3. Export a comparison bundle: `reach export --compare`
4. Move to [Example 03: Junction to Decision](../03-junction-to-decision/)

## Troubleshooting

**Issue:** `diff-run` shows no differences  
**Fix:** Ensure runs use different seed files (v1 vs v2)

**Issue:** Explain output is empty  
**Fix:** Verify both runs completed successfully first
