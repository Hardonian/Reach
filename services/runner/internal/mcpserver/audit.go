package mcpserver

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"reach/services/runner/internal/jobs"
)

type NopAuditLogger struct{}

func (NopAuditLogger) LogToolInvocation(context.Context, AuditEntry)          {}
func (NopAuditLogger) LogAuditEvent(context.Context, DeterministicAuditEvent) {}

type LogAuditLogger struct{}

func (LogAuditLogger) LogToolInvocation(_ context.Context, entry AuditEntry) {
	log.Printf("mcp audit run=%s tool=%s success=%t capabilities=%v error=%s", entry.RunID, entry.Tool, entry.Success, entry.Capabilities, entry.Error)
}

func (LogAuditLogger) LogAuditEvent(_ context.Context, entry DeterministicAuditEvent) {
	log.Printf("mcp audit seq=%d type=%s run=%s pack=%s@%s decision=%s reasons=%v", entry.Sequence, entry.EventType, entry.RunID, entry.PackID, entry.PackVersion, entry.Decision, entry.Reasons)
}

type StoreAuditLogger struct{ Store *jobs.Store }

func (l StoreAuditLogger) LogToolInvocation(ctx context.Context, entry AuditEntry) {
	if l.Store == nil || entry.RunID == "" {
		return
	}
	// Use Unix timestamp for deterministic serialization
	ts := time.Unix(entry.Timestamp, 0).Format(time.RFC3339Nano)
	body, err := json.Marshal(map[string]any{"tool": entry.Tool, "success": entry.Success, "error": entry.Error, "capabilities": entry.Capabilities, "timestamp": ts})
	if err != nil {
		return
	}
	_ = l.Store.PublishEvent(ctx, entry.RunID, jobs.Event{Type: "tool.audit", Payload: body, CreatedAt: time.Now().UTC()}, "mcp")
}

func (l StoreAuditLogger) LogAuditEvent(ctx context.Context, entry DeterministicAuditEvent) {
	if l.Store == nil || entry.RunID == "" {
		return
	}
	// Use Unix timestamp for deterministic serialization
	ts := time.Unix(entry.Timestamp, 0).Format(time.RFC3339Nano)
	body, err := json.Marshal(map[string]any{
		"sequence":              entry.Sequence,
		"event_type":            entry.EventType,
		"run_id":                entry.RunID,
		"pack_id":               entry.PackID,
		"pack_version":          entry.PackVersion,
		"pack_hash":             entry.PackHash,
		"node_id":               entry.NodeID,
		"org_id":                entry.OrgID,
		"policy_version":        entry.PolicyVersion,
		"context_snapshot_hash": entry.ContextSnapshotHash,
		"timestamp":             ts,
		"decision":              entry.Decision,
		"reasons":               entry.Reasons,
	})
	if err != nil {
		return
	}
	_ = l.Store.PublishEvent(ctx, entry.RunID, jobs.Event{Type: "audit.trail", Payload: body, CreatedAt: time.Now().UTC()}, "mcp")
}
