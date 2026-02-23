# Cost Guard Example

Demonstrates Reach's adaptive routing based on budget constraints.

## What This Demonstrates

- Budget-aware model selection
- Graceful degradation under constraints
- Cost estimation before execution
- Real-time spend tracking

## The Routing Logic

Reach automatically selects the appropriate model tier based on your budget:

| Budget | Tier     | Models                     | Est. Cost/1K tokens |
| ------ | -------- | -------------------------- | ------------------- |
| $0.10  | minimal  | gpt-3.5-turbo              | $0.0015             |
| $1.00  | standard | gpt-4, claude-3-sonnet     | $0.015-0.03         |
| $10.00 | premium  | gpt-4-turbo, claude-3-opus | $0.03-0.06          |

## Running It

```bash
# Low budget - routes to minimal tier
reach demo cost-guard --budget 0.10

# Medium budget - routes to standard tier
reach demo cost-guard --budget 1.00

# High budget - routes to premium tier
reach demo cost-guard --budget 10.00
```

## Expected Output (Low Budget)

```
[reach] Loading pack: examples.cost-guard@v1.0.0
[reach] Budget: $0.10
[reach] Evaluating routing policies...

  📊 Cost Analysis:
    Budget: $0.10
    Task complexity: medium
    Estimated tokens: ~2,000

  🎯 Selected Tier: minimal
    Model: gpt-3.5-turbo
    Est. cost: $0.003
    Confidence: 0.72

  Reason: Budget constrained. Standard tier would consume
          30% of budget. Minimal tier sufficient for task.

[reach] Executing with selected model...
[reach] ✓ Complete
[reach] Actual cost: $0.0028
[reach] Remaining budget: $0.0972
```

## Expected Output (High Budget)

```
[reach] Budget: $10.00
[reach] 🎯 Selected Tier: premium
    Model: claude-3-opus
    Est. cost: $0.12
    Confidence: 0.94

  Reason: Budget allows premium tier. Higher quality
          output justifies additional cost for this task.
```

## How Routing Works

### 1. Task Complexity Assessment

Reach analyzes the task to estimate:

- Token count (input + output)
- Required reasoning depth
- Quality requirements

### 2. Cost Estimation

```typescript
const estimate = {
  inputTokens: estimateTokens(task.input),
  outputTokens: estimateTokens(task.output) * 2, // Conservative
  modelRate: MODEL_RATES[selectedModel],
  total: inputCost + outputCost,
};
```

### 3. Budget Safety Check

```typescript
if (estimate.total > budget * 0.5) {
  // Downgrade tier to preserve budget
  selectedTier = selectCheaperTier();
}
```

### 4. Execution with Monitoring

Real-time cost tracking during execution:

- Stop if approaching budget limit
- Allow overrides for critical operations
- Alert on unexpected spend

## Policy Configuration

```json
{
  "policy": "cost-hard-ceiling",
  "rules": [
    {
      "type": "hard_limit",
      "max_spend": "${budget}",
      "action": "block"
    },
    {
      "type": "warning",
      "threshold": 0.8,
      "action": "notify"
    }
  ]
}
```

## Multi-Step Budget Management

For complex workflows, budget is allocated per-step:

```typescript
const workflowBudget = {
  total: 5.0,
  steps: {
    analyze: 1.0, // 20%
    synthesize: 2.5, // 50%
    verify: 1.0, // 20%
    reserve: 0.5, // 10% buffer
  },
};
```

## Integration with Usage Tracking

Connect to your billing system:

```typescript
import { costTracker } from "@reach/cost";

costTracker.onSpend((event) => {
  // Send to your analytics
  analytics.track("reach_spend", {
    amount: event.cost,
    model: event.model,
    tenant: event.tenantId,
  });
});
```

## Emergency Overrides

Sometimes you need to exceed budget for critical operations:

```bash
# Require manual approval for budget override
reach demo cost-guard --budget 0.10 --override-required

# Pre-approved override
reach demo cost-guard --budget 0.10 --override --reason "production-incident"
```

## Best Practices

1. **Set conservative budgets** - Allow 20% buffer
2. **Monitor trends** - Track spend over time
3. **Use tier appropriate for task** - Don't over-provision
4. **Enable alerts** - Get notified before limits

## Next Steps

Explore [multi-step-reasoning](../multi-step-reasoning/) for complex decision chains.
