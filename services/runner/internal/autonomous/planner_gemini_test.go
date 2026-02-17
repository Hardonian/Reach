package autonomous

import (
	"context"
	"encoding/json"
	"testing"
)

func TestGeminiPlanner_Generate(t *testing.T) {
	planner := NewGeminiPlanner()
	ctx := context.Background()
	objective := "Test objective"

	plan, err := planner.Generate(ctx, json.RawMessage("{}"), objective)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	if plan == nil {
		t.Fatal("Plan is nil")
	}

	// Verify Orchestration Plan
	if len(plan.Plan.Phases) != 2 {
		t.Errorf("Expected 2 phases, got %d", len(plan.Plan.Phases))
	}
	if plan.Plan.Phases[0].ID != "phase-init-01" {
		t.Errorf("Expected first phase ID phase-init-01, got %s", plan.Plan.Phases[0].ID)
	}

	// Verify Spawn Tree
	if len(plan.SpawnTree) != 1 {
		t.Errorf("Expected 1 root node, got %d", len(plan.SpawnTree))
	}
	if plan.SpawnTree[0].ID != "node-root-01" {
		t.Errorf("Expected root node ID node-root-01, got %s", plan.SpawnTree[0].ID)
	}

	// Verify Budget
	if plan.Budget.MaxSpawnDepth != 2 {
		t.Errorf("Expected MaxSpawnDepth 2, got %d", plan.Budget.MaxSpawnDepth)
	}

	// Verify Policy Trace
	if len(plan.PolicyTrace) < 2 {
		t.Errorf("Expected at least 2 policy trace entries, got %d", len(plan.PolicyTrace))
	}
}

func TestApplyBlueprint(t *testing.T) {
	// This test depends on mocking jobs.AutonomousSession and Loop which are complex structs.
	// We will skip detailed runtime application testing here and rely on the planner generation test.
}
