# Multi-Step Reasoning - CLI Walkthrough

## Step 1: Generate Scenarios

```bash
cd examples/demo/multi-step-reasoning
npx tsx seed.ts
```

Creates decision scenarios in `.scenarios/`.

## Step 2: Run Basic Reasoning

```bash
reach demo multi-step-reasoning
```

Shows the 3-step reasoning process.

## Step 3: Extended Reasoning

```bash
reach demo multi-step-reasoning --steps 5 --explore-evidence
```

Includes VOI calculation and evidence exploration.

## Step 4: Export Decision Graph

```bash
reach demo multi-step-reasoning --export-graph graph.dot

# Visualize (requires GraphViz)
dot -Tpng graph.dot -o decision-graph.png
```

## Step 5: Compare Scenarios

```bash
# Cloud region selection
reach demo multi-step-reasoning --scenario cloud-region

# Architecture decision
reach demo multi-step-reasoning --scenario architecture-decision
```

## Step 6: Confidence Analysis

```bash
reach demo multi-step-reasoning --analyze-confidence
```

Shows confidence progression:
```
Confidence Evolution:
  Initial:     0.33 ▓▓▓░░░░░░░
  +Evidence:   0.53 ▓▓▓▓▓░░░░░
  +Analysis:   0.71 ▓▓▓▓▓▓▓░░░
  Final:       0.78 ▓▓▓▓▓▓▓▓░░
```

## CLI Flags Reference

| Flag | Description | Default |
|------|-------------|---------|
| `--steps <n>` | Number of reasoning steps | 3 |
| `--explore-evidence` | Show VOI calculations | false |
| `--scenario <name>` | Select scenario | cloud-region |
| `--export-graph` | Save graphviz DOT file | - |
| `--analyze-confidence` | Show confidence progression | false |
| `--min-confidence <n>` | Required confidence threshold | 0.7 |
