package jobs

import (
	"context"
	"fmt"
	"hash/fnv"
	"math/rand"
)

// Predictor defines the interface for outcome simulation.
type Predictor interface {
	Predict(ctx context.Context, action string, runID string) (float64, string)
}

// ConfidenceWeightedBranch handles conditional execution based on model confidence.
type ConfidenceWeightedBranch struct {
	Threshold float64
	Predictor Predictor
}

// DecideBranch selects the best path based on confidence score.
func (b *ConfidenceWeightedBranch) DecideBranch(ctx context.Context, action string, runID string, primaryPath, fallbackPath func() error) error {
	predictor := b.Predictor
	if predictor == nil {
		predictor = &DeterministicPredictor{}
	}

	confidence, reason := predictor.Predict(ctx, action, runID)

	if confidence >= b.Threshold {
		fmt.Printf("Execution: Confidence (%.2f) >= Threshold (%.2f) [%s]. Using primary path.\n", confidence, b.Threshold, reason)
		return primaryPath()
	}

	fmt.Printf("Execution: Confidence (%.2f) < Threshold (%.2f) [%s]. Triggering fallback path.\n", confidence, b.Threshold, reason)
	return fallbackPath()
}

// DeterministicPredictor provides consistent simulation results.
type DeterministicPredictor struct{}

func (p *DeterministicPredictor) Predict(ctx context.Context, action string, runID string) (float64, string) {
	// Deterministic seed based on action and runID
	h := fnv.New64a()
	h.Write([]byte(action))
	h.Write([]byte(runID))

	seed := int64(h.Sum64())
	r := rand.New(rand.NewSource(seed))

	// Simulation logic: baseline confidence is high but action-dependent
	baseConf := 0.75
	reason := "historical_baseline"
	if action == "unsafe_op" {
		baseConf = 0.4
		reason = "safety_constraint"
	}

	// Add some deterministic variance
	variance := (r.Float64() - 0.5) * 0.2 // +/- 10%
	return baseConf + variance, reason
}

// SimulateExecution runs a deterministic "dry-run" to estimate outcome confidence.
func SimulateExecution(ctx context.Context, action string, runID string) float64 {
	p := &DeterministicPredictor{}
	conf, _ := p.Predict(ctx, action, runID)
	return conf
}
