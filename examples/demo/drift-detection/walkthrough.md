# Drift Detection - CLI Walkthrough

## Step 1: Generate Baseline Data

```bash
cd examples/demo/drift-detection
npx tsx seed.ts
```

This creates:

- `.baseline/normal-baseline.json` - 100 normal runs
- `.baseline/drift-scenario.json` - 50 runs with injected drift

## Step 2: Run Normal Detection

```bash
reach demo drift-detection
```

Expected output:

```
[reach] Loading pack: examples.drift-detection@v1.0.0
[reach] Baseline: 100 historical runs
[reach] Drift threshold: 0.10
[reach] ✓ No drift detected (score: 0.03)
```

## Step 3: Inject Drift

```bash
reach demo drift-detection --inject-drift
```

Expected output:

```
[reach] ⚠️  DRIFT DETECTED
[reach] Drift score: 0.34 (exceeds threshold: 0.10)
[reach] Indicators:
  - Duration: 612ms (2.5x baseline)
  - Success rate: 70% (down from 98%)
```

## Step 4: Export Drift Report

```bash
reach demo drift-detection --export-report drift-analysis.json
cat drift-analysis.json | jq '.driftIndicators'
```

## Step 5: Adjust Threshold

```bash
# More sensitive (will trigger more alerts)
reach demo drift-detection --threshold 0.05

# Less sensitive (allows more variance)
reach demo drift-detection --threshold 0.20
```

## Understanding Drift Scores

| Score     | Meaning         | Action         |
| --------- | --------------- | -------------- |
| 0.00-0.05 | Normal variance | None           |
| 0.05-0.10 | Elevated        | Monitor        |
| 0.10-0.25 | Warning         | Investigate    |
| 0.25+     | Critical        | Alert + Review |

## CLI Flags

| Flag                | Description              | Default |
| ------------------- | ------------------------ | ------- |
| `--inject-drift`    | Simulate drift scenario  | false   |
| `--threshold <n>`   | Drift alert threshold    | 0.10    |
| `--baseline <path>` | Custom baseline data     | auto    |
| `--export-report`   | Save analysis to file    | -       |
| `--verbose`         | Show calculation details | false   |
