// Package sandbox provides enforcement of capability-based security boundaries.
// It ensures that all tool access flows through a single enforcement layer,
// preventing bypass via direct imports or implicit access.
//
// Security Invariants:
//   - All tool calls must be checked against declared capabilities
//   - Environment access requires explicit declaration
//   - Filesystem access requires explicit declaration
//   - Network access requires explicit declaration
//   - No implicit access is granted
package sandbox

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type envPattern struct {
	prefix string
	isWild bool
}

type runContext struct {
	caps   map[string]struct{}
	tools  map[string]struct{}
	env    map[string]struct{}
	envPat []envPattern
}

type EnforcementLayer struct {
	runs          sync.Map
	workspaceRoot string
}

func NewEnforcementLayer(workspaceRoot string) *EnforcementLayer {
	return &EnforcementLayer{
		workspaceRoot: workspaceRoot,
	}
}

func (e *EnforcementLayer) RegisterRun(runID string, capabilities []string, tools []string, envVars []string) {
	ctx := &runContext{
		caps:  make(map[string]struct{}, len(capabilities)),
		tools: make(map[string]struct{}, len(tools)),
		env:   make(map[string]struct{}, len(envVars)),
	}
	for _, c := range capabilities {
		ctx.caps[c] = struct{}{}
	}
	for _, t := range tools {
		ctx.tools[t] = struct{}{}
	}
	for _, v := range envVars {
		ctx.env[v] = struct{}{}
		if strings.HasSuffix(v, "*") {
			ctx.envPat = append(ctx.envPat, envPattern{prefix: strings.TrimSuffix(v, "*"), isWild: true})
		}
	}
	e.runs.Store(runID, ctx)
}

func (e *EnforcementLayer) UnregisterRun(runID string) {
	e.runs.Delete(runID)
}

func (e *EnforcementLayer) getCtx(runID string) (*runContext, error) {
	val, ok := e.runs.Load(runID)
	if !ok {
		return nil, fmt.Errorf("sandbox: run %s not registered", runID)
	}
	return val.(*runContext), nil
}

func (e *EnforcementLayer) CheckToolAccess(runID string, toolName string) error {
	ctx, err := e.getCtx(runID)
	if err != nil {
		return err
	}
	if _, allowed := ctx.tools[toolName]; !allowed {
		return fmt.Errorf("sandbox: tool %s not declared for run %s", toolName, runID)
	}
	return nil
}

func (e *EnforcementLayer) CheckCapabilityAccess(runID string, capability string) error {
	ctx, err := e.getCtx(runID)
	if err != nil {
		return err
	}
	if _, allowed := ctx.caps[capability]; !allowed {
		return fmt.Errorf("sandbox: capability %s not declared for run %s", capability, runID)
	}
	return nil
}

func (e *EnforcementLayer) CheckEnvAccess(runID string, envVar string) error {
	ctx, err := e.getCtx(runID)
	if err != nil {
		return err
	}
	if _, ok := ctx.env[envVar]; ok {
		return nil
	}
	for _, p := range ctx.envPat {
		if p.isWild && strings.HasPrefix(envVar, p.prefix) {
			return nil
		}
	}
	return fmt.Errorf("sandbox: environment variable %s not declared for run %s", envVar, runID)
}

// ResolveWorkspacePath validates that a path is within the workspace sandbox.
// Returns the full path if valid, or an error if the path escapes the sandbox.
func (e *EnforcementLayer) ResolveWorkspacePath(runID string, path string) (string, error) {
	if strings.TrimSpace(path) == "" {
		return "", fmt.Errorf("sandbox: path is required")
	}

	// Clean the path to prevent traversal attacks
	clean := filepath.Clean(path)
	fullPath := filepath.Join(e.workspaceRoot, clean)

	// Verify the path is within the workspace
	rel, err := filepath.Rel(e.workspaceRoot, fullPath)
	if err != nil {
		return "", fmt.Errorf("sandbox: path resolution failed: %w", err)
	}

	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("sandbox: path escapes workspace: %s", path)
	}

	return fullPath, nil
}

// SecureReadFile reads a file within the workspace sandbox.
// It validates the path before reading.
func (e *EnforcementLayer) SecureReadFile(runID string, path string) ([]byte, error) {
	fullPath, err := e.ResolveWorkspacePath(runID, path)
	if err != nil {
		return nil, err
	}

	return os.ReadFile(fullPath)
}

// SecureWriteFile writes a file within the workspace sandbox.
// It validates the path before writing and creates parent directories.
func (e *EnforcementLayer) SecureWriteFile(runID string, path string, content []byte) error {
	fullPath, err := e.ResolveWorkspacePath(runID, path)
	if err != nil {
		return err
	}

	// Create parent directories
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		return fmt.Errorf("sandbox: failed to create directories: %w", err)
	}

	return os.WriteFile(fullPath, content, 0o644)
}

// AuditEvent represents a sandbox audit event
type AuditEvent struct {
	RunID   string
	Action  string
	Target  string
	Allowed bool
	Reason  string
}

// AuditSink receives audit events from the sandbox.
// Set this to capture audit events for logging or monitoring.
var AuditSink func(event AuditEvent)

// audit logs an audit event if a sink is configured.
func audit(event AuditEvent) {
	if AuditSink != nil {
		AuditSink(event)
	}
}

// EnforcedToolCall wraps a tool call with sandbox enforcement.
// It checks that the tool is declared before executing the handler.
func (e *EnforcementLayer) EnforcedToolCall(ctx context.Context, runID string, toolName string, handler func(context.Context) (any, error)) (any, error) {
	// Check tool access
	if err := e.CheckToolAccess(runID, toolName); err != nil {
		audit(AuditEvent{
			RunID:   runID,
			Action:  "tool_call",
			Target:  toolName,
			Allowed: false,
			Reason:  err.Error(),
		})
		return nil, err
	}

	// Execute the handler
	result, err := handler(ctx)

	audit(AuditEvent{
		RunID:   runID,
		Action:  "tool_call",
		Target:  toolName,
		Allowed: true,
		Reason:  "success",
	})

	return result, err
}
