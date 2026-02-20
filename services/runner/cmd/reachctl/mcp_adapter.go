package main

import (
	"context"
	"reach/services/runner/internal/jobs"
	"reach/services/runner/internal/mcpserver"
)

// LocalMCPClient wraps the internal mcpserver.Server to implement the jobs.ToolClient interface.
type LocalMCPClient struct {
	server *mcpserver.Server
}

func (c *LocalMCPClient) Call(ctx context.Context, runID string, action string, inputs map[string]any) (jobs.ToolResult, error) {
	// Map 'read_file' to 'tool.read_file' as expected by mcpserver
	toolName := action
	if action == "read_file" {
		toolName = "tool.read_file"
	} else if action == "write_file" {
		toolName = "tool.write_file"
	} else if action == "summarize" {
		toolName = "tool.summarize"
	}

	out, err := c.server.CallTool(ctx, runID, toolName, inputs)
	return jobs.ToolResult{
		Output:     out,
		TokenUsage: 50, // Simulated token count for demo
	}, err
}

// Simple implementations for mcpserver requirements

type simplePolicy struct{}

func (p *simplePolicy) Allowed(runID, capability string) bool          { return true }
func (p *simplePolicy) ProfileAllowed(profile, capability string) bool { return true }

type simpleAudit struct{}

func (a *simpleAudit) LogToolInvocation(ctx context.Context, entry mcpserver.AuditEntry)          {}
func (a *simpleAudit) LogAuditEvent(ctx context.Context, entry mcpserver.DeterministicAuditEvent) {}

type simpleResolver struct{}

func (r *simpleResolver) Resolve(runID, tool string) (mcpserver.ConnectorContext, error) {
	return mcpserver.ConnectorContext{
		Enabled:      true,
		Scopes:       []string{"workspace:read", "workspace:write"},
		Capabilities: []string{"filesystem:write"},
	}, nil
}

type simpleApproval struct{}

func (a *simpleApproval) Required(runID, tool string) bool { return false }
