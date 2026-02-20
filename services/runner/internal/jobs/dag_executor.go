package jobs

import (
	"context"
	"fmt"
	"reach/services/runner/internal/pack"
	"sync"
)

// ToolClient defines the interface for executing actions via MCP or other connectors.
type ToolClient interface {
	Call(ctx context.Context, runID string, action string, inputs map[string]any) (any, error)
}

// DAGExecutor handles the parallel/sequential execution of pack nodes.
type DAGExecutor struct {
	Registry *pack.PackRegistry
	Client   ToolClient
}

// ExecutionState tracks the progress of a DAG run.
type ExecutionState struct {
	Results map[string]interface{}
	mu      sync.Mutex
}

func NewDAGExecutor(registry *pack.PackRegistry, client ToolClient) *DAGExecutor {
	return &DAGExecutor{Registry: registry, Client: client}
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
	if e.Client == nil {
		return nil, fmt.Errorf("no tool client configured")
	}

	// We use the node ID or a generic run context for the runID in this simple implementation.
	runID := "todo-run-id"

	// Map generic node actions to tool names if necessary
	toolName := node.Tool
	if toolName == "" {
		toolName = node.Action
	}

	return e.Client.Call(ctx, runID, toolName, node.Inputs)
}
