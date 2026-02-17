# Model Routing Specification

## 1. Routing Logic
The Model Engine routes requests to the optimal model using a filtering and ranking process:

1. **Policy Filter**: Exclude models that violate Org Policy (e.g. unapproved providers, cost limits).
2. **Capability Filter**: Exclude models that do not meet the node's requirements (Reasoning Depth, Determinism).
3. **Selection**: Rank remaining candidates based on the active `OptimizationMode`.

## 2. Metadata Schema
Models are described by `ModelMetadata`:
- **ID**: Unique model identifier.
- **ReasoningDepth**: `low`, `medium`, `high`.
- **Deterministic**: Boolean flag for deterministic support.
- **AvgLatencyMs**: Average latency in milliseconds.
- **CostScore**: Normalized cost rating (1-10).

## 3. Routing Context
Routing decisions use a context object containing:
- `OrgPolicy`: Global constraints.
- `PackRequirements`: Local constraints needed by the task.
- `OptimizationMode`: The current preference (Cost, Latency, etc.).
- `Deterministic`: Global flag to force deterministic behavior.

## 4. Determinism
When `DeterministicStrict` or `Deterministic` flag is active:
- Only models with `deterministic_support=true` are considered.
- Adaptive swaps are limited to stable choices to ensure replay consistency.
