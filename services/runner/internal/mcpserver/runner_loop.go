package mcpserver

import (
	"context"
	"encoding/json"
	"time"

	"reach/services/runner/internal/jobs"
)

type RunLoop struct {
	Server   *Server
	Store    *jobs.Store
	TenantID string
}

func (r *RunLoop) InvokeTool(ctx context.Context, runID string, tool string, args map[string]any) error {
	result, err := r.Server.CallTool(ctx, runID, tool, args)
	payload := map[string]any{"tool": tool, "arguments": args, "run_id": runID}
	if err != nil {
		payload["error"] = err.Error()
	} else {
		payload["result"] = result
	}
	body, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return marshalErr
	}
	evtType := "tool.result"
	if err != nil {
		evtType = "tool.error"
	}
	if r.Store != nil {
		_, _ = r.Store.AppendEvent(ctx, r.TenantID, runID, jobs.Event{Type: evtType, Payload: body, CreatedAt: time.Now().UTC()})
	}
	return err
}
