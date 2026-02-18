package mcpserver

import (
	"context"
	"encoding/json"

	"reach/services/runner/internal/determinism"
	"reach/services/runner/internal/jobs"
)

// RunLoop manages the execution loop for a run.
type RunLoop struct {
	Server   *Server
	Store    *jobs.Store
	TenantID string
}

// InvokeTool invokes a tool and publishes the result as an event.
// It uses deterministic JSON serialization for event payloads.
func (r *RunLoop) InvokeTool(ctx context.Context, runID string, tool string, args map[string]any) error {
	result, err := r.Server.CallTool(ctx, runID, tool, args)

	// Build payload with deterministic field ordering
	payload := map[string]any{
		"arguments": args,
		"result":    nil,
		"run_id":    runID,
		"tool":      tool,
	}
	if err != nil {
		payload["error"] = err.Error()
	} else {
		payload["result"] = result
	}

	// Use deterministic JSON serialization to ensure consistent event hashes
	body, marshalErr := json.Marshal(determinism.CanonicalJSON(payload))
	if marshalErr != nil {
		return marshalErr
	}

	evtType := "tool.result"
	if err != nil {
		evtType = "tool.error"
	}

	if r.Store != nil {
		event := jobs.Event{
			Type:      evtType,
			Payload:   body,
			CreatedAt: 0, // Use deterministic timestamp (0 = epoch)
		}
		if publishErr := r.Store.PublishEvent(ctx, runID, event, "mcp"); publishErr != nil {
			return publishErr
		}
	}
	return err
}
