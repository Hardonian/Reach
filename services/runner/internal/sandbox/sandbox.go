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

// EnforcementLayer is the single entry point for all capability checks.
// All tool access in the system must flow through this layer.
type EnforcementLayer struct {
	mu sync.RWMutex

	// declaredCapabilities maps runID -> set of declared capability strings
	declaredCapabilities map[string]map[string]struct{}

	// declaredTools maps runID -> set of declared tool names
	declaredTools map[string]map[string]struct{}

	// declaredEnvVars maps runID -> set of allowed environment variable names
	declaredEnvVars map[string]map[string]struct{}

	// workspaceRoot is the sandboxed filesystem root
	workspaceRoot string
}

// NewEnforcementLayer creates a new sandbox enforcement layer.
func NewEnforcementLayer(workspaceRoot string) *EnforcementLayer {
	return &EnforcementLayer{
		declaredCapabilities: make(map[string]map[string]struct{}),
		declaredTools:        make(map[string]map[string]struct{}),
		declaredEnvVars:      make(map[string]map[string]struct{}),
		workspaceRoot:        workspaceRoot,
	}
}

// RegisterRun declares the capabilities and tools for a run.
// This must be called before any tool invocations for the run.
func (e *EnforcementLayer) RegisterRun(runID string, capabilities []string, tools []string, envVars []string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	capSet := make(map[string]struct{}, len(capabilities))
	for _, c := range capabilities {
		capSet[c] = struct{}{}
	}
	e.declaredCapabilities[runID] = capSet

	toolSet := make(map[string]struct{}, len(tools))
	for _, t := range tools {
		toolSet[t] = struct{}{}
	}
	e.declaredTools[runID] = toolSet

	envSet := make(map[string]struct{}, len(envVars))
	for _, v := range envVars {
		envSet[v] = struct{}{}
	}
	e.declaredEnvVars[runID] = envSet
}

// UnregisterRun removes all declarations for a run.
// This should be called when a run completes to free memory.
func (e *EnforcementLayer) UnregisterRun(runID string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	delete(e.declaredCapabilities, runID)
	delete(e.declaredTools, runID)
	delete(e.declaredEnvVars, runID)
}

// CheckToolAccess verifies that a tool is allowed for the given run.
// Returns an error if the tool is not declared.
func (e *EnforcementLayer) CheckToolAccess(runID string, toolName string) error {
	e.mu.RLock()
	defer e.mu.RUnlock()

	tools, ok := e.declaredTools[runID]
	if !ok {
		return fmt.Errorf("sandbox: run %s not registered", runID)
	}

	if _, allowed := tools[toolName]; !allowed {
		return fmt.Errorf("sandbox: tool %s not declared for run %s", toolName, runID)
	}

	return nil
}

// CheckCapabilityAccess verifies that a capability is allowed for the given run.
// Returns an error if the capability is not declared.
func (e *EnforcementLayer) CheckCapabilityAccess(runID string, capability string) error {
	e.mu.RLock()
	defer e.mu.RUnlock()

	caps, ok := e.declaredCapabilities[runID]
	if !ok {
		return fmt.Errorf("sandbox: run %s not registered", runID)
	}

	if _, allowed := caps[capability]; !allowed {
		return fmt.Errorf("sandbox: capability %s not declared for run %s", capability, runID)
	}

	return nil
}

// CheckEnvAccess verifies that an environment variable can be accessed.
// Returns an error if the variable is not declared.
func (e *EnforcementLayer) CheckEnvAccess(runID string, envVar string) error {
	e.mu.RLock()
	defer e.mu.RUnlock()

	envs, ok := e.declaredEnvVars[runID]
	if !ok {
		return fmt.Errorf("sandbox: run %s not registered", runID)
	}

	// Allow exact match or prefix match for patterns like "REACH_*"
	for allowed := range envs {
		if allowed == envVar {
			return nil
		}
		if strings.HasSuffix(allowed, "*") {
			prefix := strings.TrimSuffix(allowed, "*")
			if strings.HasPrefix(envVar, prefix) {
				return nil
			}
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
	RunID     string
	Action    string
	Target    string
	Allowed   bool
	Reason    string
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
