// Package agents provides the core agent runtime layer for Reach.
//
// This package defines deterministic execution contracts, typed input/output
// schemas, and validation for all agent operations. It is intentionally
// decoupled from UI, routing, and API layers — agents can be invoked via
// CLI, API route, or programmatically.
//
// Design invariants:
//   - All inputs are validated before execution begins.
//   - All outputs conform to typed schemas.
//   - Execution fails closed (deny by default).
//   - No unbounded recursion or memory growth.
//   - Structured logging with deterministic IDs on every operation.
package agents

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// AgentID is a typed identifier for agents.
type AgentID string

// RunID is a typed identifier for execution runs.
type RunID string

// TaskID is a typed identifier for individual tasks within a run.
type TaskID string

// Status represents the outcome status of an agent execution.
type Status string

const (
	StatusPending  Status = "pending"
	StatusRunning  Status = "running"
	StatusSuccess  Status = "success"
	StatusFailure  Status = "failure"
	StatusError    Status = "error"
	StatusTimeout  Status = "timeout"
	StatusCanceled Status = "canceled"
)

// IsTerminal returns true if the status represents a final state.
func (s Status) IsTerminal() bool {
	switch s {
	case StatusSuccess, StatusFailure, StatusError, StatusTimeout, StatusCanceled:
		return true
	}
	return false
}

// AgentSpec defines the static specification of an agent — what it can do,
// what it requires, and its operational constraints.
type AgentSpec struct {
	// ID is the unique identifier for this agent type.
	ID AgentID `json:"id"`

	// Name is the human-readable agent name.
	Name string `json:"name"`

	// Version is the semantic version of this agent spec.
	Version string `json:"version"`

	// Capabilities declares what this agent is allowed to do.
	Capabilities []string `json:"capabilities"`

	// MaxConcurrency is the maximum number of concurrent executions.
	// Zero means use the runtime default.
	MaxConcurrency int `json:"max_concurrency,omitempty"`

	// Timeout is the default per-execution timeout.
	// Zero means use the runtime default.
	Timeout time.Duration `json:"timeout,omitempty"`

	// MaxRetries is the maximum number of retries on retryable failure.
	MaxRetries int `json:"max_retries,omitempty"`

	// MaxDepth is the maximum spawn depth for child agents.
	MaxDepth int `json:"max_depth,omitempty"`

	// MaxChildren is the maximum number of child agents that can be spawned.
	MaxChildren int `json:"max_children,omitempty"`
}

// Validate checks that the AgentSpec is well-formed.
func (s AgentSpec) Validate() error {
	if s.ID == "" {
		return fmt.Errorf("agents: spec ID is required")
	}
	if s.Name == "" {
		return fmt.Errorf("agents: spec Name is required")
	}
	if s.Version == "" {
		return fmt.Errorf("agents: spec Version is required")
	}
	if s.MaxConcurrency < 0 {
		return fmt.Errorf("agents: MaxConcurrency must be >= 0")
	}
	if s.MaxRetries < 0 {
		return fmt.Errorf("agents: MaxRetries must be >= 0")
	}
	if s.MaxDepth < 0 {
		return fmt.Errorf("agents: MaxDepth must be >= 0")
	}
	if s.MaxChildren < 0 {
		return fmt.Errorf("agents: MaxChildren must be >= 0")
	}
	return nil
}

// Request is the typed input to an agent execution.
type Request struct {
	// RunID is the top-level run this request belongs to.
	RunID RunID `json:"run_id"`

	// TaskID is the unique identifier for this specific task.
	TaskID TaskID `json:"task_id"`

	// AgentID identifies which agent should handle this request.
	AgentID AgentID `json:"agent_id"`

	// ParentTaskID is the task that spawned this one (empty for root).
	ParentTaskID TaskID `json:"parent_task_id,omitempty"`

	// Depth is the current spawn depth (0 = root).
	Depth int `json:"depth"`

	// TenantID is the owning tenant.
	TenantID string `json:"tenant_id"`

	// Tool is the tool to invoke.
	Tool string `json:"tool"`

	// Arguments is the JSON-encoded tool arguments.
	Arguments json.RawMessage `json:"arguments"`

	// Permissions is the set of permissions granted.
	Permissions []string `json:"permissions,omitempty"`

	// Timeout overrides the agent spec default.
	Timeout time.Duration `json:"timeout,omitempty"`

	// Metadata carries opaque caller metadata.
	Metadata map[string]string `json:"metadata,omitempty"`
}

// Validate checks that the Request is well-formed.
func (r Request) Validate() error {
	if r.RunID == "" {
		return fmt.Errorf("agents: request RunID is required")
	}
	if r.TaskID == "" {
		return fmt.Errorf("agents: request TaskID is required")
	}
	if r.AgentID == "" {
		return fmt.Errorf("agents: request AgentID is required")
	}
	if r.TenantID == "" {
		return fmt.Errorf("agents: request TenantID is required")
	}
	if r.Tool == "" {
		return fmt.Errorf("agents: request Tool is required")
	}
	if r.Depth < 0 {
		return fmt.Errorf("agents: request Depth must be >= 0")
	}
	if r.Arguments != nil && !json.Valid(r.Arguments) {
		return fmt.Errorf("agents: request Arguments must be valid JSON")
	}
	return nil
}

// Result is the typed output from an agent execution.
type Result struct {
	// TaskID matches the request TaskID.
	TaskID TaskID `json:"task_id"`

	// Status is the execution outcome.
	Status Status `json:"status"`

	// Output is the JSON-encoded execution output.
	Output json.RawMessage `json:"output,omitempty"`

	// Error contains error details if Status is not success.
	Error *ExecError `json:"error,omitempty"`

	// Metrics captures execution performance data.
	Metrics ExecMetrics `json:"metrics"`
}

// ExecError describes a typed execution error.
type ExecError struct {
	// Code is a machine-readable error code.
	Code string `json:"code"`

	// Message is a human-readable error description.
	Message string `json:"message"`

	// Retryable indicates if this error can be retried.
	Retryable bool `json:"retryable"`
}

func (e *ExecError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// ExecMetrics captures timing and cost data for an execution.
type ExecMetrics struct {
	// StartedAt is when execution began.
	StartedAt time.Time `json:"started_at"`

	// CompletedAt is when execution finished.
	CompletedAt time.Time `json:"completed_at"`

	// Duration is the wall-clock execution time.
	Duration time.Duration `json:"duration"`

	// RetryCount is the number of retries performed.
	RetryCount int `json:"retry_count,omitempty"`

	// CostUSD is the estimated cost in USD.
	CostUSD float64 `json:"cost_usd,omitempty"`
}

// Handler is the core interface that agent implementations must satisfy.
// It takes a validated Request and produces a Result.
type Handler interface {
	Handle(ctx context.Context, req Request) (*Result, error)
}

// HandlerFunc is a function adapter for Handler.
type HandlerFunc func(ctx context.Context, req Request) (*Result, error)

// Handle implements Handler.
func (f HandlerFunc) Handle(ctx context.Context, req Request) (*Result, error) {
	return f(ctx, req)
}

// Middleware wraps a Handler with additional behavior.
type Middleware func(Handler) Handler
