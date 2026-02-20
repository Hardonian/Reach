package jobs

import (
	"context"
	"fmt"
	"os"
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

	if entry.Result.Graph == nil {
		return nil, fmt.Errorf("pack graph is missing")
	}

	state := &ExecutionState{
		Results: make(map[string]interface{}),
	}

	fmt.Printf("Executing pack %s (v%s)...\n", entry.Result.Metadata.Name, entry.Result.Metadata.Version)

	// Step-by-step sequential execution for simplicity (MVP)
	// In production, this would use a topological sort and worker pool.
	for _, node := range entry.Result.Graph.Nodes {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		fmt.Printf("Running node: %s (Type: %s)\n", node.ID, node.Type)
		result, err := e.ExecuteNode(ctx, node, inputs, state)
		if err != nil {
			return nil, fmt.Errorf("node %s failed: %w", node.ID, err)
		}

		state.mu.Lock()
		state.Results[node.ID] = result
		state.mu.Unlock()
	}

	return state.Results, nil
}

// ExecuteNode performs the action associated with a graph node.
func (e *DAGExecutor) ExecuteNode(ctx context.Context, node pack.Node, inputs map[string]interface{}, state *ExecutionState) (interface{}, error) {
	switch node.Type {
	case "Action":
		return e.handleAction(ctx, node, inputs)
	case "Condition":
		// Placeholder for branching logic
		return true, nil
	case "Parallel":
		// Placeholder for sub-graph execution
		return nil, nil
	default:
		return nil, fmt.Errorf("unknown node type: %s", node.Type)
	}
}

func (e *DAGExecutor) handleAction(ctx context.Context, node pack.Node, _ map[string]interface{}) (interface{}, error) {
	switch node.Action {
	case "read_file":
		path, ok := node.Inputs["path"].(string)
		if !ok {
			return nil, fmt.Errorf("read_file requires 'path' input")
		}
		// Security: In production, validate path against sandbox rules
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("failed to read file: %w", err)
		}
		return string(data), nil
	case "summarize":
		// Placeholder for LLM call
		return "This is a simulated summary of the data.", nil
	default:
		return fmt.Sprintf("Result of action: %s", node.Action), nil
	}
}
