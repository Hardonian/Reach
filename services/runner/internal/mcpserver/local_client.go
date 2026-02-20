package mcpserver

import (
	"context"
	"reach/services/runner/internal/jobs"
)

// LocalMCPClient wraps the internal Server to implement the jobs.ToolClient interface.
type LocalMCPClient struct {
	Server *Server
}

func (c *LocalMCPClient) Call(ctx context.Context, runID string, action string, inputs map[string]any) (jobs.ToolResult, error) {
	// Map common actions to tool names
	toolName := action
	if action == "read_file" {
		toolName = "tool.read_file"
	} else if action == "write_file" {
		toolName = "tool.write_file"
	} else if action == "summarize" {
		toolName = "tool.summarize"
	}

	out, err := c.Server.CallTool(ctx, runID, toolName, inputs)
	return jobs.ToolResult{
		Output:     out,
		TokenUsage: 50, // Simulated
	}, err
}

// Simple mocks for mcpserver dependencies

type SimplePolicy struct{}

func (p *SimplePolicy) Allowed(runID, capability string) bool          { return true }
func (p *SimplePolicy) ProfileAllowed(profile, capability string) bool { return true }

type SimpleAudit struct{}

func (a *SimpleAudit) LogToolInvocation(ctx context.Context, entry AuditEntry)          {}
func (a *SimpleAudit) LogAuditEvent(ctx context.Context, entry DeterministicAuditEvent) {}

type SimpleResolver struct{}

func (r *SimpleResolver) Resolve(runID, tool string) (ConnectorContext, error) {
	return ConnectorContext{
		Enabled:      true,
		Scopes:       []string{"workspace:read", "workspace:write"},
		Capabilities: []string{"filesystem:write"},
	}, nil
}

type SimpleApproval struct{}

func (a *SimpleApproval) Required(runID, tool string) bool { return false }

func NewMockServer(workspaceRoot string) *Server {
	return New(workspaceRoot, &SimplePolicy{}, &SimpleAudit{}, &SimpleResolver{}, &SimpleApproval{})
}
