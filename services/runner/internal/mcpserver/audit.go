package mcpserver

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"reach/services/runner/internal/jobs"
)

type NopAuditLogger struct{}

func (NopAuditLogger) LogToolInvocation(context.Context, AuditEntry) {}

type LogAuditLogger struct{}

func (LogAuditLogger) LogToolInvocation(_ context.Context, entry AuditEntry) {
	log.Printf("mcp audit run=%s tool=%s success=%t capabilities=%v error=%s", entry.RunID, entry.Tool, entry.Success, entry.Capabilities, entry.Error)
}

type StoreAuditLogger struct{ Store *jobs.Store }

func (l StoreAuditLogger) LogToolInvocation(_ context.Context, entry AuditEntry) {
	if l.Store == nil || entry.RunID == "" {
		return
	}
	body, err := json.Marshal(map[string]any{"tool": entry.Tool, "success": entry.Success, "error": entry.Error, "capabilities": entry.Capabilities, "timestamp": entry.Timestamp.Format(time.RFC3339Nano)})
	if err != nil {
		return
	}
	_ = l.Store.PublishEvent(entry.RunID, jobs.Event{Type: "tool.audit", Payload: body, CreatedAt: time.Now().UTC()}, "mcp")
}
