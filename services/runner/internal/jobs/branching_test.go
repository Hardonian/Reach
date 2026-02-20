package jobs

import (
	"context"
	"testing"
)

func TestDeterministicSimulation(t *testing.T) {
	ctx := context.Background()
	action := "test_action"
	runID := "run-123"

	res1 := SimulateExecution(ctx, action, runID)
	res2 := SimulateExecution(ctx, action, runID)

	if res1 != res2 {
		t.Fatalf("Simulation not deterministic: %f != %f", res1, res2)
	}

	diffRunID := "run-456"
	res3 := SimulateExecution(ctx, action, diffRunID)

	if res1 == res3 {
		// This could theoretically happen by chance (1 in 2^64) but good to check they differ for different runs
		t.Logf("Warning: Different runs produced same result (expected variance)")
	}

	t.Logf("Determinstic results: %f (run1), %f (run2), %f (run3)", res1, res2, res3)
}

func TestSafetyConstraint(t *testing.T) {
	ctx := context.Background()
	runID := "run-123"

	normalRes := SimulateExecution(ctx, "read_file", runID)
	unsafeRes := SimulateExecution(ctx, "unsafe_op", runID)

	if unsafeRes >= normalRes {
		t.Errorf("Unsafe op should have lower confidence, got %f >= %f", unsafeRes, normalRes)
	}
}
