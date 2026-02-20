package jobs

import (
	"context"
	"fmt"
	"hash/fnv"
	"math/rand"
)

// ConfidenceWeightedBranch handles conditional execution based on model confidence.
type ConfidenceWeightedBranch struct {
	Threshold float64
}

// DecideBranch selects the best path based on confidence score.
func (b *ConfidenceWeightedBranch) DecideBranch(ctx context.Context, primaryPath, fallbackPath func() error, confidence float64) error {
	if confidence >= b.Threshold {
		fmt.Printf("Execution: Confidence (%.2f) >= Threshold (%.2f). Using primary path.\n", confidence, b.Threshold)
		return primaryPath()
	}

	fmt.Printf("Execution: Confidence (%.2f) < Threshold (%.2f). Triggering fallback path.\n", confidence, b.Threshold)
	return fallbackPath()
}

// SimulateExecution runs a deterministic "dry-run" to estimate outcome confidence.
// It uses a hash of the action and run-specific context to ensure consistency.
func SimulateExecution(ctx context.Context, action string, runID string) float64 {
	// Deterministic seed based on action and runID
	h := fnv.New64a()
	h.Write([]byte(action))
	h.Write([]byte(runID))

	seed := int64(h.Sum64())
	r := rand.New(rand.NewSource(seed))

	// Simulation logic: baseline confidence is high but action-dependent
	baseConf := 0.75
	if action == "unsafe_op" {
		baseConf = 0.4
	}

	// Add some deterministic variance
	variance := (r.Float64() - 0.5) * 0.2 // +/- 10%
	return baseConf + variance
}
