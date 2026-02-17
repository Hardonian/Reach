package autonomous

import (
	"errors"
	"reach/services/runner/internal/registry"
)

// ModelMetadata describes the capabilities and performance profile of a model.
type ModelMetadata struct {
	ID             string `json:"id"`
	ReasoningDepth string `json:"reasoning_depth"` // low, medium, high
	Deterministic  bool   `json:"deterministic_support"`
	AvgLatencyMs   int    `json:"avg_latency_ms"`
	CostScore      int    `json:"cost_score"` // 1 (cheap) - 10 (expensive)
}

// RouterContext provides context for making routing decisions.
type RouterContext struct {
	OrgPolicy        OrgPolicy
	PackRequirements registry.ModelCapabilities
	OptimizationMode registry.OptimizationMode
	Deterministic    bool // Global override
}

// OrgPolicy defines organization-level constraints on model usage.
type OrgPolicy struct {
	AllowedModels []string `json:"allowed_models"`
	MaxCostScore  int      `json:"max_cost_score"`
}

// RoutingError represents a failure to select a suitable model.
var ErrNoSuitableModel = errors.New("no suitable model found for requirements")

// RouteModel selects the best model based on the context and available models.
func RouteModel(models []ModelMetadata, ctx RouterContext) (string, error) {
	var candidates []ModelMetadata

	// 1. Filter by Org Policy
	for _, m := range models {
		if !isAllowed(m.ID, ctx.OrgPolicy.AllowedModels) {
			continue
		}
		if ctx.OrgPolicy.MaxCostScore > 0 && m.CostScore > ctx.OrgPolicy.MaxCostScore {
			continue
		}
		candidates = append(candidates, m)
	}

	if len(candidates) == 0 {
		return "", ErrNoSuitableModel
	}

	// 2. Filter by Pack Requirements & Determinism
	var qualified []ModelMetadata
	for _, m := range candidates {
		// If strict determinism is required (globally or by pack), model must support it
		if (ctx.Deterministic || ctx.PackRequirements.ReqDeterministic) && !m.Deterministic {
			continue
		}
		// Check reasoning depth requirement
		if !satisfiesReasoning(m.ReasoningDepth, ctx.PackRequirements.ReqReasoningDepth) {
			continue
		}
		qualified = append(qualified, m)
	}

	if len(qualified) == 0 {
		return "", ErrNoSuitableModel
	}

	candidates = qualified

	// 3. Optimization Mode Selection
	best := candidates[0]

	switch ctx.OptimizationMode {
	case registry.OptModeCostOptimized:
		for _, m := range candidates {
			if m.CostScore < best.CostScore {
				best = m
			}
		}
	case registry.OptModeLatencyOptimized:
		for _, m := range candidates {
			if m.AvgLatencyMs < best.AvgLatencyMs {
				best = m
			}
		}
	case registry.OptModeQualityOptimized:
		// Logic: Higher reasoning depth = better quality.
		// Tie-break with cost (more expensive usually better for quality in this simplified model)
		for _, m := range candidates {
			currentScore := getReasoningScore(best.ReasoningDepth)
			newScore := getReasoningScore(m.ReasoningDepth)

			if newScore > currentScore {
				best = m
			} else if newScore == currentScore {
				// Tie-break: if quality optimized, maybe prefer the "smarter" (often more expensive/robust) one?
				// Or maybe prefer lower latency?
				// Let's use cost as proxy for "capability" in tie-break for Quality mode
				if m.CostScore > best.CostScore {
					best = m
				}
			}
		}
	case registry.OptModeDeterministicStrict:
		// Any qualified model supports determinism.
		// We might prefer the one with lowest latency to keep things fast,
		// or lowest cost. Let's default to cost optimization among deterministic models.
		for _, m := range candidates {
			if m.CostScore < best.CostScore {
				best = m
			}
		}
	default:
		// Default: Balanced. Maybe defined as cost-optimized but ensuring at least medium reasoning?
		// For now, default to cost optimized.
		for _, m := range candidates {
			if m.CostScore < best.CostScore {
				best = m
			}
		}
	}

	return best.ID, nil
}

func isAllowed(id string, allowed []string) bool {
	if len(allowed) == 0 {
		return true
	}
	for _, a := range allowed {
		if a == id {
			return true
		}
	}
	return false
}

func satisfiesReasoning(modelDepth, requiredDepth string) bool {
	scores := map[string]int{"low": 1, "medium": 2, "high": 3}
	m := scores[modelDepth]
	// If modelDepth is unknown, assume low (1)
	if m == 0 {
		m = 1
	}

	r := scores[requiredDepth]
	if r == 0 {
		return true // No requirement
	}
	return m >= r
}

func getReasoningScore(depth string) int {
	scores := map[string]int{"low": 1, "medium": 2, "high": 3}
	return scores[depth]
}
