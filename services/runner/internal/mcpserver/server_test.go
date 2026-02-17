package mcpserver

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

type captureAudit struct {
	entries []AuditEntry
}

type staticResolver struct{ ctx ConnectorContext }

func (s staticResolver) Resolve(_ string, _ string) (ConnectorContext, error) { return s.ctx, nil }

type staticApproval struct{ required bool }

func (s staticApproval) Required(_ string, _ string) bool { return s.required }

func (c *captureAudit) LogToolInvocation(_ context.Context, entry AuditEntry) {
	c.entries = append(c.entries, entry)
}

func TestReadWriteAndCapabilityChecks(t *testing.T) {
	workspace := t.TempDir()
	audit := &captureAudit{}
	srv := New(workspace, NewStaticPolicy(nil), audit, staticResolver{ctx: ConnectorContext{Enabled: true, Scopes: []string{"workspace:read", "workspace:write"}, Capabilities: nil, Policy: "moderate"}}, staticApproval{})

	if _, err := srv.CallTool(context.Background(), "run-1", "tool.write_file", map[string]any{"path": "a.txt", "content": "hello"}); !errors.Is(err, ErrCapabilityDenied) {
		t.Fatalf("expected capability denied, got %v", err)
	}

	srv = New(workspace, NewStaticPolicy([]string{CapabilityFilesystemWrite}), audit, staticResolver{ctx: ConnectorContext{Enabled: true, Scopes: []string{"workspace:read", "workspace:write"}, Capabilities: []string{CapabilityFilesystemWrite}, Policy: "moderate"}}, staticApproval{})
	if _, err := srv.CallTool(context.Background(), "run-1", "tool.write_file", map[string]any{"path": "dir/a.txt", "content": "hello"}); err != nil {
		t.Fatalf("write failed: %v", err)
	}
	res, err := srv.CallTool(context.Background(), "run-1", "tool.read_file", map[string]any{"path": "dir/a.txt"})
	if err != nil {
		t.Fatalf("read failed: %v", err)
	}
	obj := res.(map[string]any)
	if obj["content"] != "hello" {
		t.Fatalf("unexpected content: %v", obj["content"])
	}
}

func TestPathTraversalDenied(t *testing.T) {
	workspace := t.TempDir()
	srv := New(workspace, NewStaticPolicy([]string{CapabilityFilesystemWrite}), NopAuditLogger{}, staticResolver{ctx: ConnectorContext{Enabled: true, Scopes: []string{"workspace:read", "workspace:write"}, Capabilities: []string{CapabilityFilesystemWrite}, Policy: "moderate"}}, staticApproval{})

	_, err := srv.CallTool(context.Background(), "run-1", "tool.read_file", map[string]any{"path": "../etc/passwd"})
	if err == nil {
		t.Fatal("expected traversal error")
	}
}

func TestWriteCreatesFileInWorkspace(t *testing.T) {
	workspace := t.TempDir()
	srv := New(workspace, NewStaticPolicy([]string{CapabilityFilesystemWrite}), NopAuditLogger{}, staticResolver{ctx: ConnectorContext{Enabled: true, Scopes: []string{"workspace:read", "workspace:write"}, Capabilities: []string{CapabilityFilesystemWrite}, Policy: "moderate"}}, staticApproval{})

	_, err := srv.CallTool(context.Background(), "run-7", "tool.write_file", map[string]any{"path": "nested/file.txt", "content": "abc"})
	if err != nil {
		t.Fatalf("write failed: %v", err)
	}
	filePath := filepath.Join(workspace, "nested", "file.txt")
	content, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("read file failed: %v", err)
	}
	if string(content) != "abc" {
		t.Fatalf("unexpected content: %s", content)
	}
}

func TestFirewallBlocksScopeAndApproval(t *testing.T) {
	workspace := t.TempDir()
	srv := New(workspace, NewStaticPolicy([]string{CapabilityFilesystemWrite}), NopAuditLogger{}, staticResolver{ctx: ConnectorContext{Enabled: true, Scopes: []string{"workspace:read"}, Capabilities: []string{CapabilityFilesystemWrite}, Policy: "moderate"}}, staticApproval{})
	if _, err := srv.CallTool(context.Background(), "run-1", "tool.write_file", map[string]any{"path": "x.txt", "content": "x"}); !errors.Is(err, ErrScopeDenied) {
		t.Fatalf("expected scope denied: %v", err)
	}
	srv = New(workspace, NewStaticPolicy([]string{CapabilityFilesystemWrite}), NopAuditLogger{}, staticResolver{ctx: ConnectorContext{Enabled: true, Scopes: []string{"workspace:read", "workspace:write"}, Capabilities: []string{CapabilityFilesystemWrite}, Policy: "moderate"}}, staticApproval{required: true})
	if _, err := srv.CallTool(context.Background(), "run-1", "tool.read_file", map[string]any{"path": "x.txt"}); !errors.Is(err, ErrApprovalRequired) {
		t.Fatalf("expected approval required: %v", err)
	}
}
