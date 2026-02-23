# Example 03: Junction to Decision

**Purpose:** Generate junction, evaluate decision, show trace. Learn the junction-decision workflow.

**Level:** Intermediate  
**Estimated Time:** 4 minutes

## Quick Run

```bash
node examples/03-junction-to-decision/run.js
```

## What This Example Demonstrates

1. **Junction Creation** - Creating a decision point with multiple options
2. **Policy Evaluation** - Applying governance rules to options
3. **Decision Selection** - Choosing optimal path based on evidence
4. **Trace Visualization** - Understanding the decision flow

## Concepts

### Junction
A junction represents a decision point with multiple possible paths:
- Options with associated evidence
- Policy constraints
- Value of information calculations

### Decision
A decision is the selected path from a junction:
- Chosen option
- Rejected alternatives with rationale
- Evidence supporting the choice
- Audit trail

## Expected Output

```
=== Junction: Deployment Strategy ===
Options:
  1. Blue-Green (confidence: 0.85)
  2. Canary (confidence: 0.72)
  3. Rolling (confidence: 0.65)

Policy Evaluation:
  ✓ Downtime requirement: PASS
  ✓ Rollback capability: PASS
  ✓ Risk threshold: PASS

Decision: Blue-Green
Rationale: Highest confidence, meets all policies
Trace: junction → evaluate → decide → record
```

## Files

| File | Purpose |
|------|---------|
| `junction.json` | Junction definition with options |
| `policies.json` | Policy constraints for evaluation |
| `run.js` | Runner demonstrating workflow |
| `expected-trace.json` | Expected decision trace |

## Workflow Steps

1. **Create Junction** - Define decision point with options
2. **Add Evidence** - Attach supporting data to each option
3. **Evaluate** - Apply policies, calculate confidence
4. **Decide** - Select optimal option
5. **Record** - Store decision with full trace

## What To Try Next

1. Modify junction options and re-evaluate
2. Add custom policies to constrain choices
3. Try [Example 04: Action Plan Execute](../04-action-plan-execute-safe/)
