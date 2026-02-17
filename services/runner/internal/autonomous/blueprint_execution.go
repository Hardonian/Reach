package autonomous

import (
	"context"
	"fmt"
	"time"

	"reach/services/runner/internal/jobs"
)

// ApplyBlueprint configures the AutonomousSession and Loop parameters based on the OrchestrationBlueprint.
// It acts as the bridge between the high-level plan and the runtime execution engine.
func ApplyBlueprint(session *jobs.AutonomousSession, loop *Loop, bp *OrchestrationBlueprint) error {
	if bp == nil {
		return fmt.Errorf("blueprint is nil")
	}

	// 1. Enforce Budget on Session
	// Map plan budget to session limits
	if bp.Budget.MaxChildrenPerNode > 0 {
		// Heuristic: If we spawn children, we might need more iterations or tools.
		// For now, we don't directly map MaxChildrenPerNode to session fields unless we add specific fields to AutonomousSession.
		// We can ensure the capabilities are allowed.
	}

	if bp.Budget.RetryLimit > 0 {
		loop.RepeatedFailureLimit = bp.Budget.RetryLimit
	}

	// 2. Set Timeouts
	if totalTimeout, ok := bp.Timeouts["total_plan"]; ok && totalTimeout > 0 {
		session.MaxRuntime = time.Duration(totalTimeout) * time.Millisecond
	}

	// 3. Capability Enforcement
	// We should verify that the session allows the required capabilities.
	allowedCaps := make(map[string]struct{})
	for _, c := range session.AllowedCapabilities {
		allowedCaps[c] = struct{}{}
	}

	for _, req := range bp.CapabilityPlan.RequiredCapabilities {
		if _, ok := allowedCaps[req]; !ok {
			return fmt.Errorf("missing required capability: %s", req)
		}
	}

	// 4. Update Goal with plan description if needed
	if bp.Plan.Description != "" && session.Goal == "" {
		session.Goal = bp.Plan.Description
	}

	return nil
}

// ExecuteBlueprint is a helper that would orchestrate the execution of the blueprint phases.
// Currently, the Loop runs a single agent. To support the multi-agent spawn tree,
// this function would need to interact with the Job Store to spawn child runs.
func ExecuteBlueprint(ctx context.Context, store *jobs.Store, parentRunID string, bp *OrchestrationBlueprint) error {
	// This is a placeholder for the multi-agent orchestration logic.
	// It would traverse bp.SpawnTree and create jobs.Run entries for each child.

	// Example logic (commented out until Spawn support is added to Store):
	/*
		for _, node := range bp.SpawnTree {
			if node.ID == "node-root-01" {
				// The root is likely the current run.
				// Process children.
				for _, child := range node.Children {
					// store.CreateRun(ctx, child.AgentType, ...)
				}
			}
		}
	*/

	return nil
}
