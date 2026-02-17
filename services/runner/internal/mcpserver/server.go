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
	ErrToolNotFound     = errors.New("tool not found")
	ErrCapabilityDenied = errors.New("capability denied")
)

type Policy interface {
	Allowed(runID, capability string) bool
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
}

func New(workspaceRoot string, policy Policy, audit AuditLogger) *Server {
	s := &Server{
		workspaceRoot: workspaceRoot,
		policy:        policy,
		audit:         audit,
		mcpServer:     mcp.NewServer(mcp.WithName("reach-runner"), mcp.WithVersion("0.1.0")),
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
	if capErr := s.checkCapabilities(runID, tool); capErr != nil {
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

func (s *Server) checkCapabilities(runID, tool string) error {
	for _, capability := range requiredCapabilities(tool) {
		if !s.policy.Allowed(runID, capability) {
			return fmt.Errorf("%w: %s", ErrCapabilityDenied, capability)
		}
	}
	return nil
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
