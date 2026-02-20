package registry

import (
	"fmt"
	"math"
	"reach/services/runner/internal/pack"
	"reach/services/runner/internal/telemetry"
)

// ReputationEngine computes quality scores from telemetry.
type ReputationEngine struct {
	telemetry *telemetry.PackTelemetry
}

func NewReputationEngine(pt *telemetry.PackTelemetry) *ReputationEngine {
	return &ReputationEngine{telemetry: pt}
}

// ComputeScore calculates the current reputation for a pack.
func (e *ReputationEngine) ComputeScore(packID string) (*pack.PackQualityScore, error) {
	metrics, err := e.telemetry.LoadMetrics(packID)
	if err != nil {
		return nil, fmt.Errorf("failed to load metrics: %w", err)
	}

	score := &pack.PackQualityScore{
		StabilityScore:  1.0 - metrics.FailureRate,
		ComplianceScore: 1.0 - metrics.PolicyViolationRate,
		EfficiencyScore: math.Max(0, 1.0-(metrics.AvgLatency/5000.0)), // Baseline 5s
	}

	// For demo, grounding score is high if tool misuse is low
	score.GroundingScore = 1.0 - metrics.ToolMisuseRate

	// Aggregate reputation score (0-100)
	raw := (score.StabilityScore*0.4 + score.ComplianceScore*0.3 + score.GroundingScore*0.2 + score.EfficiencyScore*0.1)
	score.ReputationScore = math.Floor(raw * 100.0)

	return score, nil
}

// CheckDeprecation evaluates if a pack should be flagged as "at-risk".
func (e *ReputationEngine) CheckDeprecation(packID string) (bool, string) {
	metrics, err := e.telemetry.LoadMetrics(packID)
	if err != nil {
		return false, ""
	}

	if metrics.PolicyViolationRate > 0.1 {
		return true, "high_policy_violations"
	}
	if metrics.FailureRate > 0.3 {
		return true, "unstable_execution"
	}

	return false, ""
}
