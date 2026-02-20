package agents

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// BridgeConfig configures the bridge between the agent runtime and external callers.
type BridgeConfig struct {
	TenantID string
	RunID    string
}

// Bridge provides a simplified entry point for invoking agents from CLI, API, or tests.
// It wraps the Runtime with request construction and result extraction.
type Bridge struct {
	runtime *Runtime
	config  BridgeConfig
}

// NewBridge creates a new bridge to the agent runtime.
func NewBridge(rt *Runtime, config BridgeConfig) *Bridge {
	return &Bridge{
		runtime: rt,
		config:  config,
	}
}

// Invoke executes an agent with the given tool and arguments.
// This is the primary entry point for CLI and API callers.
func (b *Bridge) Invoke(ctx context.Context, agentID AgentID, tool string, args json.RawMessage, opts ...InvokeOption) (*Result, error) {
	o := invokeOptions{}
	for _, opt := range opts {
		opt(&o)
	}

	taskID := TaskID(uuid.New().String())
	runID := RunID(b.config.RunID)
	if o.runID != "" {
		runID = o.runID
	}

	req := Request{
		RunID:        runID,
		TaskID:       taskID,
		AgentID:      agentID,
		TenantID:     b.config.TenantID,
		Tool:         tool,
		Arguments:    args,
		Permissions:  o.permissions,
		Timeout:      o.timeout,
		Depth:        o.depth,
		ParentTaskID: o.parentTaskID,
		Metadata:     o.metadata,
	}

	return b.runtime.Execute(ctx, req)
}

// InvokeOption configures a single invocation.
type InvokeOption func(*invokeOptions)

type invokeOptions struct {
	runID        RunID
	parentTaskID TaskID
	depth        int
	permissions  []string
	timeout      time.Duration
	metadata     map[string]string
}

// WithRunID overrides the bridge's default RunID.
func WithRunID(id RunID) InvokeOption {
	return func(o *invokeOptions) { o.runID = id }
}

// WithParent sets the parent task for spawn tracking.
func WithParent(parentID TaskID, depth int) InvokeOption {
	return func(o *invokeOptions) {
		o.parentTaskID = parentID
		o.depth = depth
	}
}

// WithPermissions sets the permissions for the invocation.
func WithPermissions(perms ...string) InvokeOption {
	return func(o *invokeOptions) { o.permissions = perms }
}

// WithTimeout sets a per-invocation timeout.
func WithInvokeTimeout(d time.Duration) InvokeOption {
	return func(o *invokeOptions) { o.timeout = d }
}

// WithMetadata sets opaque metadata on the request.
func WithMetadata(m map[string]string) InvokeOption {
	return func(o *invokeOptions) { o.metadata = m }
}

// InvokeBatch executes multiple agent requests concurrently and collects results.
// It respects the runtime's concurrency limits.
func (b *Bridge) InvokeBatch(ctx context.Context, requests []BatchRequest) []BatchResult {
	results := make([]BatchResult, len(requests))

	type indexedResult struct {
		idx    int
		result *Result
		err    error
	}

	ch := make(chan indexedResult, len(requests))

	for i, req := range requests {
		go func(idx int, br BatchRequest) {
			result, err := b.Invoke(ctx, br.AgentID, br.Tool, br.Arguments, br.Options...)
			ch <- indexedResult{idx: idx, result: result, err: err}
		}(i, req)
	}

	for range requests {
		ir := <-ch
		results[ir.idx] = BatchResult{
			Request: requests[ir.idx],
			Result:  ir.result,
			Err:     ir.err,
		}
	}

	return results
}

// BatchRequest is a single request in a batch invocation.
type BatchRequest struct {
	AgentID   AgentID
	Tool      string
	Arguments json.RawMessage
	Options   []InvokeOption
}

// BatchResult pairs a request with its result.
type BatchResult struct {
	Request BatchRequest
	Result  *Result
	Err     error
}

// CLIResult is a simplified result format suitable for CLI output.
type CLIResult struct {
	Status    string          `json:"status"`
	Output    json.RawMessage `json:"output,omitempty"`
	Error     string          `json:"error,omitempty"`
	Duration  string          `json:"duration"`
	Retries   int             `json:"retries,omitempty"`
}

// ToCLIResult converts a Result to a CLI-friendly format.
func ToCLIResult(r *Result) CLIResult {
	cr := CLIResult{
		Status:   string(r.Status),
		Output:   r.Output,
		Duration: r.Metrics.Duration.String(),
		Retries:  r.Metrics.RetryCount,
	}
	if r.Error != nil {
		cr.Error = fmt.Sprintf("[%s] %s", r.Error.Code, r.Error.Message)
	}
	return cr
}
