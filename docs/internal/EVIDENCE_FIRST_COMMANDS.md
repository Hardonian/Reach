# Evidence-First Commands (Core Engine V2)

This document describes the new evidence-first commands added to Reach CLI as part of the Core Engine V2 implementation.

## Overview

The Evidence-First Determinism Suite provides commands for:

- **Step Identity**: Stable identifiers for execution steps
- **Proof Hashes**: Cryptographic verification of step execution
- **Checkpoints**: Save and rewind run state
- **Simulation**: Preview runs against history
- **Chaos Testing**: Verify determinism under perturbation
- **Provenance**: Track origin of runs and artifacts
- **Trust Scoring**: Compute trust based on evidence

## Commands

### `steps <runId>`

List all steps in a run with their proof hashes.

```bash
# List steps for a run
reachctl steps run-123456

# Output with full hashes
reachctl steps run-123456 --verbose

# JSON output for automation
reachctl steps run-123456 --json
```

**Example Output:**

```
Steps for run run-123456
================
Total steps: 3

[1] step-1
    Proof: a1b2c3d4e5f6789a...

[2] step-2
    Proof: b2c3d4e5f6a78901...

[3] step-3
    Proof: c3d4e5f6a7b89012...
```

### `proof <runId> [--step <stepId>]`

Show proof chain details for a run or specific step.

```bash
# Show proof chain for entire run
reachctl proof verify run-123456

# Verify a capsule file
reachctl proof verify my-run.capsule.json
```

### `checkpoint create <runId>`

Create a checkpoint of a run for later rewinding.

```bash
# Create checkpoint
reachctl checkpoint create run-123456

# Create named checkpoint
reachctl checkpoint create run-123456 --name "before-critical-step"
```

### `checkpoint list <runId>`

List all checkpoints for a run.

```bash
reachctl checkpoint list run-123456
```

### `rewind <checkpointId>`

Rewind to a checkpoint and create a new run.

```bash
# Rewind to checkpoint
reachctl rewind run-123456-20240221120000

# Rewind with input overrides
reachctl rewind checkpoint-id --override input.key=newvalue
```

### `simulate <pipelineId>`

Simulate a run against historical data without side effects.

```bash
# Simulate against specific run
reachctl simulate my-pipeline --against run-123456

# Simulate with custom inputs
reachctl simulate my-pipeline --against run-123456 --inputs '{"key": "value"}'

# JSON output
reachctl simulate my-pipeline --against run-123456 --json
```

### `chaos <runId> --level <1-5>`

Run chaos testing to verify determinism boundaries.

```bash
# Level 1: Minimal perturbation
reachctl chaos run-123456 --level 1

# Level 3: Moderate chaos (recommended)
reachctl chaos run-123456 --level 3

# Level 5: Maximum perturbation
reachctl chaos run-123456 --level 5 --json
```

**Chaos Levels:**

- Level 1: Map iteration reordering
- Level 2: Add jitter to timeouts (bounded)
- Level 3: Random seed injection (chaos mode only)
- Level 4: Plugin scheduling perturbations
- Level 5: All perturbations combined

### `provenance <runId> [--step <stepId>]`

Show complete provenance information for a run.

```bash
# Show run provenance
reachctl provenance run-123456

# Show step-level provenance
reachctl provenance run-123456 --step step-2

# JSON output
reachctl provenance run-123456 --json
```

**Example Output:**

```
Provenance for run run-123456
==================
Spec Version: 1.0
Engine Version: 1.0.0
Git Commit: abc123def456
Working Directory Dirty: false
Events Recorded: 5
Registry Snapshot: sha256:def789...

Environment:
  os: linux
  arch: amd64
  runtime: reachctl
```

### `trust <runId>`

Calculate trust score for a run based on evidence completeness.

```bash
# Calculate trust score
reachctl trust run-123456

# With explanation
reachctl trust run-123456 --explain

# JSON output
reachctl trust run-123456 --json
```

**Scoring Model:**

- Base score: 100
- Deductions:
  - Missing provenance: -10
  - Unknown external dependency: -5
  - Chaos enabled: -5 (unless explicitly allowed)
  - Broken proof chain: -50
  - Plugin unsigned: -10

**Example Output:**

```
Trust Score Report
==================
Trust Score: 95/100
Determinism Stability: true
Replay Success: 100%
Chaos Pass Rate: 100%
Drift Incidents: 0

✓ Workspace is trustworthy!
```

### `assistant <command>`

Copilot mode for helpful suggestions (opt-in).

```bash
# Enable assistant
reachctl assistant on

# Get suggestions for a run
reachctl assistant suggest run-123456

# Explain a command
reachctl assistant explain diff-run
reachctl assistant explain checkpoint
reachctl assistant explain chaos

# Disable assistant
reachctl assistant off
```

## Determinism Verification

### Quick Verification

```bash
# Verify a run is deterministic
reachctl verify-determinism --run run-123456 --n 5

# Verify a pack produces stable results
reachctl verify-determinism --pack my-pack --n 5
```

### Diff Two Runs

```bash
# Compare two runs
reachctl diff-run run-123 run-456

# JSON output for programmatic analysis
reachctl diff-run run-123 run-456 --json
```

## Testing

Run the determinism test suite:

```bash
# Run all determinism tests
go test ./internal/determinism/...

# Run with verbose output
go test ./internal/determinism/... -v

# Run stress tests
go test ./internal/determinism/... -run Stress
```

## Implementation Details

### Step Identity

Each step has a stable `StepKey` computed from:

- Canonical step definition (sorted keys, no ephemeral fields)
- Engine version (major only)
- Plugin name and version

### Proof Hash

Each step execution produces a `ProofHash` computed from:

- StepKey hash
- Run context fingerprint
- Normalized inputs hash
- Normalized outputs hash
- Dependency proof hashes (ordered)

### Run Proof Chain

The run has an overall proof hash computed from:

- Ordered step proof hashes
- Run context fingerprint
- Engine version

## Best Practices

1. **Always verify determinism** before trusting a run
2. **Create checkpoints** at critical decision points
3. **Use simulation** to preview changes
4. **Run chaos tests** periodically to catch drift
5. **Check trust scores** before sharing capsules
6. **Review provenance** for audit compliance

## CI Integration

```yaml
# .github/workflows/evidence-check.yml
name: Evidence Check
on: [push]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify Determinism
        run: reachctl verify-determinism --pack ./my-pack --n 5
      - name: Check Trust Score
        run: |
          SCORE=$(reachctl trust $(reachctl runs list --json | jq -r '.[0].id') --json | jq -r '.trust_score')
          if [ "$SCORE" -lt 90 ]; then echo "Trust score too low"; exit 1; fi
```
