# Cost Guard - CLI Walkthrough

## Step 1: Generate Cost Data

```bash
cd examples/demo/cost-guard
npx tsx seed.ts
```

## Step 2: Run with Different Budgets

```bash
# Minimal budget - routes to gpt-3.5-turbo
reach demo cost-guard --budget 0.10

# Standard budget - routes to claude-3-sonnet
reach demo cost-guard --budget 1.00

# Premium budget - routes to claude-3-opus
reach demo cost-guard --budget 10.00
```

## Step 3: Force Downgrade Scenario

```bash
# Budget is tight for task complexity - will downgrade
reach demo cost-guard --budget 0.50 --task analysis --complexity high
```

Expected output:

```
[reach] Budget: $0.50
[reach] Task complexity: high
[reach] Estimated cost at standard tier: $0.75
[reach] ⚠️  Exceeds 50% budget threshold
[reach] 🔄 Downgrading to minimal tier
[reach] New estimate: $0.15 (30% of budget)
```

## Step 4: View Routing Table

```bash
reach demo cost-guard --show-routing-table
```

Output:

```
Tier       Max Cost    Models
─────────────────────────────────────────
minimal    $0.10       gpt-3.5-turbo
standard   $1.00       gpt-4, claude-3-sonnet
premium    $10.00      gpt-4-turbo, claude-3-opus
```

## Step 5: Cost Report

```bash
reach demo cost-guard --budget 1.00 --export-report cost-report.json

cat cost-report.json | jq '.'
```

## Budget Alert Simulation

```bash
# Set very low budget to trigger alert
reach demo cost-guard --budget 0.01
```

Expected:

```
[reach] ❌ Budget too low
[reach] Minimum required: $0.05
[reach] Your budget: $0.01
```

## CLI Flags Reference

| Flag                   | Description              | Default |
| ---------------------- | ------------------------ | ------- |
| `--budget <n>`         | Budget in USD            | 1.00    |
| `--task <type>`        | Task type for estimation | generic |
| `--complexity <level>` | low/medium/high          | medium  |
| `--show-routing-table` | Display tier mappings    | -       |
| `--export-report`      | Save cost analysis       | -       |
| `--override`           | Allow budget override    | false   |
| `--override-reason`    | Justify override         | -       |
