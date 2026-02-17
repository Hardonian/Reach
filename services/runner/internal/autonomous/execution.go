package autonomous

import (
	"context"
	"encoding/json"
	"time"
)

// ExecutionEnvelope defines the strict contract for any side-effecting operation.
// It encapsulates the tool execution request with all necessary context.
type ExecutionEnvelope struct {
	ID          string           `json:"id"`
	TaskID      string           `json:"task_id"`
	ToolName    string           `json:"tool"`
	Arguments   json.RawMessage  `json:"arguments"`
	Context     ExecutionContext `json:"context"`
	Timeout     time.Duration    `json:"-"`
	Permissions []string         `json:"permissions"`
}

// ExecutionContext holds the session-specific context for execution.
type ExecutionContext struct {
	SessionID   string `json:"session_id"`
	TenantID    string `json:"tenant_id"`
	AgentID     string `json:"agent_id"` // Node ID in the spawn tree
	PackID      string `json:"pack_id,omitempty"`
	PackVersion string `json:"pack_version,omitempty"`
	PackHash    string `json:"pack_hash,omitempty"` // For integrity validation on replay
	RunID       string `json:"run_id,omitempty"`    // Unique ID for the top-level orchestration run
	IsReplay    bool   `json:"is_replay,omitempty"` // If true, execution must be deterministic and side-effect free if possible
}

// ExecutionResult captures the outcome of an execution envelope.
type ExecutionResult struct {
	EnvelopeID string           `json:"envelope_id"`
	Status     ExecutionStatus  `json:"status"`
	Output     json.RawMessage  `json:"output,omitempty"`
	Error      *ExecutionError  `json:"error,omitempty"`
	Metrics    ExecutionMetrics `json:"metrics"`
}

type ExecutionStatus string

const (
	StatusSuccess ExecutionStatus = "success"
	StatusFailure ExecutionStatus = "failure"
	StatusError   ExecutionStatus = "error"
)

type ExecutionError struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
}

type ExecutionMetrics struct {
	Duration time.Duration `json:"duration"`
	Start    time.Time     `json:"start"`
	End      time.Time     `json:"end"`
}

// StepAction defines the intent of the step.
type StepAction string

const (
	ActionExecute StepAction = "execute"
	ActionDone    StepAction = "done"
	ActionFail    StepAction = "fail"
	ActionWait    StepAction = "wait"
)

// StepPlan defines the decision made by the planner.
type StepPlan struct {
	Action       StepAction      `json:"action"`
	Tool         string          `json:"tool,omitempty"`
	Args         json.RawMessage `json:"args,omitempty"`
	Reasoning    string          `json:"reasoning,omitempty"`
	Dependencies []string        `json:"dependencies,omitempty"`
}

// Executor defines the interface for executing atomic tasks.
// Implementations must be side-effect free outside of the tool execution itself.
type Executor interface {
	Execute(ctx context.Context, envelope ExecutionEnvelope) (*ExecutionResult, error)
}

// StepPlanner defines the interface for determining the next step in an active session.
// This separates the "what to do next" logic from the "how to do it" logic.
type StepPlanner interface {
	NextStep(ctx context.Context, session SessionState) (*StepPlan, error)
}

// SessionState is a read-only view of the session for the planner.
type SessionState struct {
	Goal           string
	History        []StepHistory
	Variables      map[string]any
	IterationCount int
}

type StepHistory struct {
	Plan   StepPlan
	Result ExecutionResult
}
