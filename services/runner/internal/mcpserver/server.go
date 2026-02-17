package mcpserver

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const CapabilityFilesystemWrite = "filesystem:write"

var (
	ErrToolNotFound      = errors.New("tool not found")
	ErrCapabilityDenied  = errors.New("capability denied")
	ErrConnectorDisabled = errors.New("connector disabled")
	ErrScopeDenied       = errors.New("scope denied")
	ErrPolicyDenied      = errors.New("policy denied")
	ErrApprovalRequired  = errors.New("approval required")
)

type Policy interface {
	Allowed(runID, capability string) bool
	ProfileAllowed(profile, capability string) bool
}

type ConnectorResolver interface {
	Resolve(runID, tool string) (ConnectorContext, error)
}

type ApprovalGate interface {
	Required(runID, tool string) bool
}

type ConnectorContext struct {
	Enabled      bool
	Scopes       []string
	Capabilities []string
	Policy       string
}

type AuditLogger interface {
	LogToolInvocation(ctx context.Context, entry AuditEntry)
}

type AuditEntry struct {
	RunID        string
	Tool         string
	Input        map[string]any
	Success      bool
	Error        string
	Timestamp    time.Time
	Capabilities []string
}

type Server struct {
	workspaceRoot string
	policy        Policy
	audit         AuditLogger
	mcpServer     *mcp.Server
	connectors    ConnectorResolver
	approvalGate  ApprovalGate
}

func New(workspaceRoot string, policy Policy, audit AuditLogger, resolver ConnectorResolver, approval ApprovalGate) *Server {
	s := &Server{
		workspaceRoot: workspaceRoot,
		policy:        policy,
		audit:         audit,
		mcpServer:     mcp.NewServer(mcp.WithName("reach-runner"), mcp.WithVersion("0.1.0")),
		connectors:    resolver,
		approvalGate:  approval,
	}
	s.registerTools()
	return s
}

func (s *Server) MCP() *mcp.Server { return s.mcpServer }

func (s *Server) registerTools() {
	s.mcpServer.AddTool(mcp.Tool{Name: "tool.echo", Description: "Echoes the input text"}, s.callEcho)
	s.mcpServer.AddTool(mcp.Tool{Name: "tool.read_file", Description: "Reads a UTF-8 file from workspace"}, s.callReadFile)
	s.mcpServer.AddTool(mcp.Tool{Name: "tool.write_file", Description: "Writes UTF-8 content to a workspace file"}, s.callWriteFile)
}

func (s *Server) CallTool(ctx context.Context, runID, tool string, input map[string]any) (any, error) {
	if capErr := s.checkFirewall(runID, tool); capErr != nil {
		s.audit.LogToolInvocation(ctx, AuditEntry{RunID: runID, Tool: tool, Input: input, Timestamp: time.Now().UTC(), Error: capErr.Error(), Capabilities: requiredCapabilities(tool)})
		return nil, capErr
	}
	result, err := s.mcpServer.CallTool(ctx, tool, input, runID)
	entry := AuditEntry{RunID: runID, Tool: tool, Input: input, Timestamp: time.Now().UTC(), Success: err == nil, Capabilities: requiredCapabilities(tool)}
	if err != nil {
		entry.Error = err.Error()
	}
	s.audit.LogToolInvocation(ctx, entry)
	return result, err
}

func requiredCapabilities(tool string) []string {
	if tool == "tool.write_file" {
		return []string{CapabilityFilesystemWrite}
	}
	return nil
}

func requiredScopes(tool string) []string {
	if tool == "tool.write_file" {
		return []string{"workspace:write"}
	}
	return []string{"workspace:read"}
}

func (s *Server) checkFirewall(runID, tool string) error {
	if s.connectors != nil {
		ctx, err := s.connectors.Resolve(runID, tool)
		if err != nil {
			return err
		}
		if !ctx.Enabled {
			return ErrConnectorDisabled
		}
		for _, scope := range requiredScopes(tool) {
			if !has(ctx.Scopes, scope) {
				return fmt.Errorf("%w: %s", ErrScopeDenied, scope)
			}
		}
		for _, capability := range requiredCapabilities(tool) {
			if !has(ctx.Capabilities, capability) {
				return fmt.Errorf("%w: %s", ErrCapabilityDenied, capability)
			}
			if !s.policy.Allowed(runID, capability) || !s.policy.ProfileAllowed(ctx.Policy, capability) {
				return fmt.Errorf("%w: %s", ErrPolicyDenied, capability)
			}
		}
	}
	if s.approvalGate != nil && s.approvalGate.Required(runID, tool) {
		return ErrApprovalRequired
	}
	return nil
}

func has(items []string, needle string) bool {
	for _, item := range items {
		if item == needle {
			return true
		}
	}
	return false
}

func (s *Server) callEcho(_ context.Context, _ string, input map[string]any) (any, error) {
	text, _ := input["text"].(string)
	return map[string]any{"text": text}, nil
}

func (s *Server) callReadFile(_ context.Context, _ string, input map[string]any) (any, error) {
	path, _ := input["path"].(string)
	fullPath, err := s.resolveWorkspacePath(path)
	if err != nil {
		return nil, err
	}

	content, err := os.ReadFile(fullPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("file not found: %s", path)
		}
		return nil, err
	}
	return map[string]any{"path": path, "content": string(content)}, nil
}

func (s *Server) callWriteFile(_ context.Context, _ string, input map[string]any) (any, error) {
	path, _ := input["path"].(string)
	content, _ := input["content"].(string)
	fullPath, err := s.resolveWorkspacePath(path)
	if err != nil {
		return nil, err
	}

	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		return nil, err
	}
	if err := os.WriteFile(fullPath, []byte(content), 0o644); err != nil {
		return nil, err
	}
	return map[string]any{"path": path, "bytes_written": len(content)}, nil
}

func (s *Server) resolveWorkspacePath(path string) (string, error) {
	if strings.TrimSpace(path) == "" {
		return "", errors.New("path is required")
	}
	clean := filepath.Clean(path)
	fullPath := filepath.Join(s.workspaceRoot, clean)
	rel, err := filepath.Rel(s.workspaceRoot, fullPath)
	if err != nil {
		return "", err
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path escapes workspace: %s", path)
	}
	return fullPath, nil
}
