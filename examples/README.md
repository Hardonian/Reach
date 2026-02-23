# Reach Examples Library

A curated collection of example packs demonstrating Reach's capabilities for deterministic execution, policy enforcement, and replay verification.

## Quick Start

```bash
# Run any example
reach demo <example-name>

# List available examples
reach demo --list

# Run with verbose output
reach demo hello-world --verbose
```

## Available Examples

### 1. hello-world
**Level:** Beginner  
**Focus:** Basic deterministic execution

A minimal pack that demonstrates the core Reach execution model. Perfect for your first Reach run.

```bash
reach demo hello-world
```

### 2. drift-detection
**Level:** Intermediate  
**Focus:** Detecting execution drift and anomalies

Shows how Reach detects when execution diverges from expected patterns. Includes intentional drift scenarios for testing detection sensitivity.

```bash
reach demo drift-detection
reach demo drift-detection --inject-drift  # Trigger drift warning
```

### 3. infra-review
**Level:** Intermediate  
**Focus:** Policy-based infrastructure decisions

Demonstrates using Reach for reviewing infrastructure changes with guardrails. Simulates a Terraform plan review with cost and security policies.

```bash
reach demo infra-review --plan ./my-plan.json
```

### 4. cost-guard
**Level:** Advanced  
**Focus:** Budget-aware execution with cost ceilings

Shows how to configure execution with strict cost controls. Demonstrates automatic routing to cheaper models when budgets are constrained.

```bash
reach demo cost-guard --budget 0.50
reach demo cost-guard --budget 5.00   # Higher budget allows better models
```

### 5. multi-step-reasoning
**Level:** Advanced  
**Focus:** Chained decisions with evidence propagation

A complex example showing multi-step reasoning where each decision feeds into the next. Demonstrates Reach's evidence chain and value of information calculations.

```bash
reach demo multi-step-reasoning --steps 5
```

## Example Structure

Each example includes:
- `pack.json` - The execution pack manifest
- `seed.ts` - Seed script for generating test data
- `walkthrough.md` - Step-by-step CLI guide
- `README.md` - Detailed explanation

## Creating Your Own

Use the scaffold command to create a new example from a template:

```bash
reach scaffold example my-example
```

## Contributing

When adding new examples:
1. Follow the existing directory structure
2. Include comprehensive README
3. Add seed script for reproducibility
4. Update this index
5. Ensure deterministic execution (`deterministic: true`)
