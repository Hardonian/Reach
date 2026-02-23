# Sample Junction Rule Plugin

Adds a new junction template for deployment strategy decisions.

## Features

- **Deployment Strategy Junction** - Creates decision points for deployment methods
- **Deterministic Scoring** - Same context → same rankings
- **Policy Integration** - Works with policy packs for constraints
- **Evidence-Based** - Each option includes supporting evidence

## Deployment Options

| Strategy | Best For | Downtime | Rollback |
|----------|----------|----------|----------|
| Blue-Green | Critical services, low risk tolerance | None | Instant |
| Canary | Gradual rollout, monitoring | None | Fast |
| Rolling | Simple services, speed | Minimal | Slow |

## Usage

```javascript
// Create a deployment decision junction
const junction = plugin.createJunction({
  service: "api-gateway",
  current_version: "2.1.0",
  target_version: "2.2.0",
  risk_tolerance: "low",
  traffic_pattern: "spiky"
});

// Evaluate and decide
const result = plugin.evaluate(junction, policies);
```

## Determinism

This plugin is fully deterministic:
- Scoring algorithm uses only input context
- Options sorted by score (stable sort)
- Evidence sorted alphabetically
- No randomness or external state

## Example Output

```json
{
  "type": "deployment-strategy",
  "options": [
    {
      "id": "blue-green",
      "score": 0.95,
      "confidence": 0.98,
      "evidence": [...]
    },
    {
      "id": "canary",
      "score": 0.72,
      "confidence": 0.85,
      "evidence": [...]
    }
  ],
  "selected": "blue-green"
}
```
