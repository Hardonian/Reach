# Multi-Step Reasoning Example

Demonstrates Reach's evidence-based decision making with value of information (VOI) calculations.

## What This Demonstrates

- Chained decisions with evidence propagation
- Uncertainty tracking across steps
- Value of Information (VOI) computation
- Confidence thresholds for decision quality

## The Scenario

You're choosing a cloud region for deployment. Multiple factors must be weighed:

1. **Latency** - How fast for your users?
2. **Cost** - Monthly infrastructure spend
3. **Compliance** - Data residency requirements
4. **Reliability** - Historical uptime

Each piece of evidence affects the final decision and its confidence.

## Running It

```bash
# Default 3-step reasoning
reach demo multi-step-reasoning

# Extended 5-step reasoning
reach demo multi-step-reasoning --steps 5

# With evidence exploration
reach demo multi-step-reasoning --explore-evidence

# Export decision graph
reach demo multi-step-reasoning --export-graph decision.dot
```

## Expected Output

```
[reach] Loading pack: examples.multi-step-reasoning@v1.0.0
[reach] Initializing evidence graph...

  🔍 Step 1: Problem Framing
    Question: Optimal cloud region?
    Criteria: latency, cost, compliance, reliability
    Prior confidence: 0.33 (uniform)

  📊 Step 2: Evidence Gathering
    Evidence A: Latency analysis
      - us-east: 45ms ± 5ms
      - eu-west: 78ms ± 8ms
      - Confidence impact: +0.12

    Evidence B: Cost analysis
      - us-east: $420/month
      - eu-west: $380/month
      - Confidence impact: +0.08

  🎯 Step 3: Hypothesis Evaluation
    H1: us-east optimal → P=0.42, confidence=0.65
    H2: eu-west optimal → P=0.58, confidence=0.78 ✓

  💡 Step 4: Value of Information
    Remaining uncertainty: 0.22
    Next best evidence: Traffic pattern analysis
    Expected value: +0.23 confidence
    Cost to acquire: $50 (analytics tool)
    Recommendation: Acquire if budget allows

  ✅ Step 5: Final Decision
    Selected: eu-west
    Confidence: 0.78
    Key factors: Cost savings, adequate latency
    Would change if: Latency requirement <50ms

[reach] Evidence chain: 4 nodes, 3 dependencies
[reach] Fingerprint: sha256:abc123...
```

## Evidence Chain Visualization

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Problem   │────▶│  Latency    │────▶│   Hypothesis│
│   Framing   │     │  Evidence   │     │ Evaluation  │
└─────────────┘     └─────────────┘     └──────┬──────┘
       │                                       │
       │         ┌─────────────┐              │
       └────────▶│   Cost      │─────────────▶│
                 │  Evidence   │              │
                 └─────────────┘              │
                                              ▼
                                       ┌─────────────┐
                                       │   Decision  │
                                       │ eu-west     │
                                       └─────────────┘
```

## Value of Information (VOI)

VOI tells you which evidence would most improve your decision:

```typescript
// VOI calculation
const voi = {
  evidence: "traffic-pattern-analysis",
  currentConfidence: 0.78,
  expectedConfidence: 0.91,  // After acquiring
  improvement: 0.13,
  costToAcquire: 50,
  valuePerDollar: 0.0026     // 0.13 / 50
};
```

## Confidence Tracking

Confidence evolves as evidence accumulates:

| Step | Confidence | Source |
|------|------------|--------|
| Initial | 0.33 | Uniform prior |
| +Latency | 0.45 | Evidence A |
| +Cost | 0.53 | Evidence B |
| +Reliability | 0.71 | Evidence C |
| Final | 0.78 | Synthesis |

## Policy: Minimum Confidence

The pack includes a confidence threshold policy:

```json
{
  "policy": "min-confidence-0.7",
  "rule": {
    "min_confidence": 0.70,
    "action": "require_more_evidence"
  }
}
```

If confidence < 0.7, Reach will:
1. Calculate VOI for remaining evidence
2. Recommend data acquisition
3. Defer decision until threshold met

## Evidence Exploration Mode

```bash
reach demo multi-step-reasoning --explore-evidence
```

This interactive mode lets you:
- See what evidence is available
- Calculate VOI for each
- Simulate "what if" scenarios
- Decide what to acquire

## Exporting Decision Graph

```bash
reach demo multi-step-reasoning --export-graph decision.dot
dot -Tpng decision.dot -o decision.png
```

Generates a visual representation of the evidence chain.

## Integration with Decision Registry

Save decisions for later review:

```typescript
import { decisionRegistry } from '@reach/decisions';

const decision = await reachDemo('multi-step-reasoning');
decisionRegistry.register({
  ...decision,
  context: 'cloud-migration-q1',
  reviewer: 'platform-team'
});
```

## Next Steps

- Review the [drift-detection](../drift-detection/) example
- Explore policy packs in `/policy-packs/`
- Build your own evidence-based packs
