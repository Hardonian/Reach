package autonomous

import (
	"errors"
	"reach/services/runner/internal/registry"
)

// ModelMetadata describes the capabilities and performance profile of a model.
type ModelMetadata struct {
	ID             string  `json:"id"`
	ReasoningDepth string  `json:"reasoning_depth"` // low, medium, high
	Deterministic  bool    `json:"deterministic_support"`
	AvgLatencyMs   int     `json:"avg_latency_ms"`
	CostScore      int     `json:"cost_score"`       // 1 (cheap) - 10 (expensive)
	CostPerInputK  float64 `json:"cost_per_input_k"` // USD per 1K input tokens
	CostPerOutputK float64 `json:"cost_per_output_k"` // USD per 1K output tokens
}

// RouterContext provides context for making routing decisions.
type RouterContext struct {
	OrgPolicy        OrgPolicy
	PackRequirements registry.ModelCapabilities
	OptimizationMode registry.OptimizationMode
	Deterministic    bool // Global override

	// Cost-aware routing fields
	BudgetUSD        float64 `json:"budget_usd"`          // Max spend for this routing decision
	EstimatedTokensIn  int   `json:"estimated_tokens_in"`  // Expected input tokens
	EstimatedTokensOut int   `json:"estimated_tokens_out"` // Expected output tokens
}

// OrgPolicy defines organization-level constraints on model usage.
type OrgPolicy struct {
	AllowedModels []string `json:"allowed_models"`
	MaxCostScore  int      `json:"max_cost_score"`
}

// RoutingDecision captures the model selection along with cost metadata.
type RoutingDecision struct {
	ModelID        string  `json:"model_id"`
	EstimatedCost  float64 `json:"estimated_cost_usd"`
	ReasoningDepth string  `json:"reasoning_depth"`
	AvgLatencyMs   int     `json:"avg_latency_ms"`
	WithinBudget   bool    `json:"within_budget"`
}

// ErrNoSuitableModel represents a failure to select a suitable model.
var ErrNoSuitableModel = errors.New("no suitable model found for requirements")

// ErrBudgetExceeded indicates all models exceed the cost budget.
var ErrBudgetExceeded = errors.New("all candidate models exceed cost budget")

// RouteModel selects the best model based on the context and available models.
func RouteModel(models []ModelMetadata, ctx RouterContext) (string, error) {
	decision, err := RouteModelWithDecision(models, ctx)
	if err != nil {
		return "", err
	}
	return decision.ModelID, nil
}

// RouteModelWithDecision selects the best model and returns the full routing decision.
func RouteModelWithDecision(models []ModelMetadata, ctx RouterContext) (RoutingDecision, error) {
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
		return RoutingDecision{}, ErrNoSuitableModel
	}

	// 2. Filter by Pack Requirements & Determinism
	var qualified []ModelMetadata
	for _, m := range candidates {
		if (ctx.Deterministic || ctx.PackRequirements.ReqDeterministic) && !m.Deterministic {
			continue
		}
		if !satisfiesReasoning(m.ReasoningDepth, ctx.PackRequirements.ReqReasoningDepth) {
			continue
		}
		qualified = append(qualified, m)
	}

	if len(qualified) == 0 {
		return RoutingDecision{}, ErrNoSuitableModel
	}

	// 3. Cost budget enforcement — filter out models that exceed budget
	if ctx.BudgetUSD > 0 {
		var affordable []ModelMetadata
		for _, m := range qualified {
			cost := estimateCost(m, ctx.EstimatedTokensIn, ctx.EstimatedTokensOut)
			if cost <= ctx.BudgetUSD {
				affordable = append(affordable, m)
			}
		}
		if len(affordable) == 0 {
			return RoutingDecision{}, ErrBudgetExceeded
		}
		qualified = affordable
	}

	candidates = qualified

	// 4. Optimization Mode Selection
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
		for _, m := range candidates {
			currentScore := getReasoningScore(best.ReasoningDepth)
			newScore := getReasoningScore(m.ReasoningDepth)
			if newScore > currentScore {
				best = m
			} else if newScore == currentScore && m.CostScore > best.CostScore {
				best = m
			}
		}
	case registry.OptModeDeterministicStrict:
		for _, m := range candidates {
			if m.CostScore < best.CostScore {
				best = m
			}
		}
	default:
		// Balanced: prefer models with best cost-to-reasoning ratio
		bestRatio := costReasoningRatio(best)
		for _, m := range candidates {
			ratio := costReasoningRatio(m)
			if ratio > bestRatio {
				best = m
				bestRatio = ratio
			}
		}
	}

	estimated := estimateCost(best, ctx.EstimatedTokensIn, ctx.EstimatedTokensOut)
	decision := RoutingDecision{
		ModelID:        best.ID,
		EstimatedCost:  estimated,
		ReasoningDepth: best.ReasoningDepth,
		AvgLatencyMs:   best.AvgLatencyMs,
		WithinBudget:   ctx.BudgetUSD <= 0 || estimated <= ctx.BudgetUSD,
	}

	return decision, nil
}

// estimateCost calculates estimated cost for a model given token counts.
func estimateCost(m ModelMetadata, tokensIn, tokensOut int) float64 {
	if m.CostPerInputK == 0 && m.CostPerOutputK == 0 {
		return 0 // Local model or unpriced
	}
	return (float64(tokensIn) / 1000.0 * m.CostPerInputK) +
		(float64(tokensOut) / 1000.0 * m.CostPerOutputK)
}

// costReasoningRatio returns a score favoring high reasoning depth per unit cost.
func costReasoningRatio(m ModelMetadata) float64 {
	reasoning := float64(getReasoningScore(m.ReasoningDepth))
	cost := float64(m.CostScore)
	if cost == 0 {
		return reasoning * 10 // Free model gets a big bonus
	}
	return reasoning / cost
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
	if m == 0 {
		m = 1
	}
	r := scores[requiredDepth]
	if r == 0 {
		return true
	}
	return m >= r
}

func getReasoningScore(depth string) int {
	scores := map[string]int{"low": 1, "medium": 2, "high": 3}
	return scores[depth]
}
