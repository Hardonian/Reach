# Drift Detection Example

Demonstrates how Reach detects when execution patterns deviate from established baselines.

## What This Demonstrates

- Baseline establishment for normal execution
- Statistical drift detection algorithms
- Policy-based drift thresholds
- Alert generation on anomaly detection

## The Drift Concept

"Drift" occurs when a system's behavior changes over time in ways that violate previous patterns. Reach continuously monitors for:

1. **Output drift** - Results differ from expected distributions
2. **Timing drift** - Execution duration changes significantly
3. **Dependency drift** - External services return different data
4. **Resource drift** - Memory/CPU usage patterns shift

## Running It

```bash
# Normal execution
reach demo drift-detection

# Simulate drift condition
reach demo drift-detection --inject-drift

# With custom threshold
reach demo drift-detection --threshold 0.05
```

## Expected Output (Normal)

```
[reach] Loading pack: examples.drift-detection@v1.0.0
[reach] Baseline established from 100 historical runs
[reach] Executing drift detection...

  Baseline stats:
    - Mean execution time: 245ms
    - Output variance: 0.002
    - Success rate: 100%

  Current run:
    - Execution time: 248ms ✓ (within 2σ)
    - Output hash: sha256:abc123 ✓ (matches pattern)

[reach] ✓ No drift detected
[reach] Drift score: 0.03 (threshold: 0.10)
```

## Expected Output (With Drift)

```
[reach] ⚠️  DRIFT DETECTED
[reach] Drift score: 0.34 (threshold: 0.10)

Drift indicators:
  - Output variance exceeded by 340%
  - Execution time 4.2σ above baseline
  - Recommended action: Review recent changes
```

## How It Works

### 1. Baseline Establishment

Reach maintains a rolling window of execution metrics:

```typescript
interface ExecutionBaseline {
  windowSize: number; // Number of runs to consider
  metrics: {
    duration: Distribution;
    outputHash: Set<string>;
    successRate: number;
  };
}
```

### 2. Statistical Monitoring

Each new run is compared against the baseline:

```typescript
// Z-score calculation for anomaly detection
const zScore = (current - mean) / stdDev;
if (Math.abs(zScore) > threshold) {
  alertDriftDetected(metric, zScore);
}
```

### 3. Policy Enforcement

Drift thresholds are configurable via policies:

```json
{
  "policy": "drift-threshold-default",
  "thresholds": {
    "zScore": 3.0,
    "outputVariance": 0.05,
    "maxDurationMs": 5000
  }
}
```

## Integration with CI/CD

Use drift detection in your CI pipeline:

```yaml
# .github/workflows/drift-check.yml
- name: Check for execution drift
  run: |
    reach demo drift-detection --json > drift-report.json
    if [ $(jq '.driftScore' drift-report.json) > 0.10 ]; then
      echo "Drift threshold exceeded!"
      exit 1
    fi
```

## Customizing Detection

Create custom drift detectors:

```typescript
// custom-drift-detector.ts
import { DriftDetector } from "@reach/monitoring";

export const customDetector: DriftDetector = {
  name: "custom-business-logic",
  detect(run: ExecutionRun): DriftResult {
    // Your custom logic here
    const driftScore = calculateMyMetric(run);
    return { driftDetected: driftScore > 0.5, score: driftScore };
  },
};
```

## Next Steps

Explore [infra-review](../infra-review/) to see policy-based decision making in action.
