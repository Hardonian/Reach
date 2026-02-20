package jobs

import (
	"context"
	"fmt"
	"reach/services/runner/internal/pack"
	"sync"
)

// DAGExecutor handles the parallel/sequential execution of pack nodes.
type DAGExecutor struct {
	Registry *pack.PackRegistry
}

// ExecutionState tracks the progress of a DAG run.
type ExecutionState struct {
	Results map[string]interface{}
	mu      sync.Mutex
}

func NewDAGExecutor(registry *pack.PackRegistry) *DAGExecutor {
	return &DAGExecutor{Registry: registry}
}

// ExecuteGraph traverses the pack's execution graph and runs nodes.
func (e *DAGExecutor) ExecuteGraph(ctx context.Context, packCID string, inputs map[string]interface{}) (map[string]interface{}, error) {
	entry, ok := e.Registry.Get(packCID)
	if !ok {
		return nil, fmt.Errorf("pack not found: %s", packCID)
	}

	state := &ExecutionState{
		Results: make(map[string]interface{}),
	}

	// Simple sequential traversal for now, mimicking a DAG runner
	fmt.Printf("Executing pack %s (v%s)...\n", entry.Result.Metadata.Name, entry.Result.Metadata.Version)

	// Simulated execution
	for i := 0; i < 5; i++ {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
	}

	return state.Results, nil
}
