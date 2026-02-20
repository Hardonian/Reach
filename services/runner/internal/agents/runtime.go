package agents

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// RuntimeConfig defines operational limits and defaults for the agent runtime.
type RuntimeConfig struct {
	// DefaultTimeout is applied when a request has no explicit timeout.
	DefaultTimeout time.Duration

	// MaxTimeout is the absolute ceiling on any execution timeout.
	MaxTimeout time.Duration

	// MaxDepth is the maximum spawn depth for agent hierarchies.
	MaxDepth int

	// MaxChildren is the maximum number of concurrent child tasks per parent.
	MaxChildren int

	// MaxConcurrency is the maximum number of concurrent executions across the runtime.
	MaxConcurrency int

	// MaxRetries is the default retry limit for retryable failures.
	MaxRetries int

	// MaxMemoryEntries is the maximum activity log entries held in memory.
	MaxMemoryEntries int
}

// DefaultRuntimeConfig returns production-safe defaults.
func DefaultRuntimeConfig() RuntimeConfig {
	return RuntimeConfig{
		DefaultTimeout:   5 * time.Minute,
		MaxTimeout:       30 * time.Minute,
		MaxDepth:         5,
		MaxChildren:      10,
		MaxConcurrency:   50,
		MaxRetries:       3,
		MaxMemoryEntries: 10000,
	}
}

// Validate checks that the config has no dangerous values.
func (c RuntimeConfig) Validate() error {
	if c.DefaultTimeout <= 0 {
		return fmt.Errorf("agents: DefaultTimeout must be > 0")
	}
	if c.MaxTimeout <= 0 {
		return fmt.Errorf("agents: MaxTimeout must be > 0")
	}
	if c.MaxTimeout < c.DefaultTimeout {
		return fmt.Errorf("agents: MaxTimeout must be >= DefaultTimeout")
	}
	if c.MaxDepth <= 0 {
		return fmt.Errorf("agents: MaxDepth must be > 0")
	}
	if c.MaxChildren <= 0 {
		return fmt.Errorf("agents: MaxChildren must be > 0")
	}
	if c.MaxConcurrency <= 0 {
		return fmt.Errorf("agents: MaxConcurrency must be > 0")
	}
	return nil
}

// Runtime is the core agent execution engine. It manages agent registration,
// request validation, execution with timeouts, retry logic, spawn depth guards,
// and structured activity logging.
//
// Runtime has no UI or route dependencies. It can be invoked from CLI, API, or tests.
type Runtime struct {
	config   RuntimeConfig
	handlers sync.Map // map[AgentID]Handler
	specs    sync.Map // map[AgentID]AgentSpec
	activity *ActivityLog

	// Concurrency control
	semaphore chan struct{}
	active    atomic.Int64
	total     atomic.Int64

	// Spawn tracking: map[TaskID]int (children count)
	spawnCounts sync.Map
}

// NewRuntime creates a new agent runtime with the given configuration.
func NewRuntime(config RuntimeConfig, opts ...ActivityLogOption) (*Runtime, error) {
	if err := config.Validate(); err != nil {
		return nil, err
	}

	logOpts := []ActivityLogOption{WithMaxEntries(config.MaxMemoryEntries)}
	logOpts = append(logOpts, opts...)

	return &Runtime{
		config:    config,
		activity:  NewActivityLog(logOpts...),
		semaphore: make(chan struct{}, config.MaxConcurrency),
	}, nil
}

// Register registers an agent handler with its spec.
func (rt *Runtime) Register(spec AgentSpec, handler Handler) error {
	if err := spec.Validate(); err != nil {
		return err
	}
	if handler == nil {
		return fmt.Errorf("agents: handler must not be nil")
	}
	rt.specs.Store(spec.ID, spec)
	rt.handlers.Store(spec.ID, handler)
	return nil
}

// Unregister removes an agent handler.
func (rt *Runtime) Unregister(id AgentID) {
	rt.handlers.Delete(id)
	rt.specs.Delete(id)
}

// GetSpec returns the spec for a registered agent.
func (rt *Runtime) GetSpec(id AgentID) (AgentSpec, bool) {
	val, ok := rt.specs.Load(id)
	if !ok {
		return AgentSpec{}, false
	}
	return val.(AgentSpec), true
}

// Execute runs an agent request through the full pipeline:
// validate → guard check → acquire semaphore → timeout → execute → retry → log.
func (rt *Runtime) Execute(ctx context.Context, req Request) (*Result, error) {
	startedAt := time.Now().UTC()

	// 1. Validate request
	if err := req.Validate(); err != nil {
		rt.activity.Record(ActivityEntry{
			Type:      ActivityValidationFailed,
			RunID:     req.RunID,
			TaskID:    req.TaskID,
			AgentID:   req.AgentID,
			TenantID:  req.TenantID,
			Status:    StatusError,
			Message:   err.Error(),
			ErrorCode: "VALIDATION_FAILED",
		})
		return &Result{
			TaskID: req.TaskID,
			Status: StatusError,
			Error:  &ExecError{Code: "VALIDATION_FAILED", Message: err.Error()},
			Metrics: ExecMetrics{
				StartedAt:   startedAt,
				CompletedAt: time.Now().UTC(),
				Duration:    time.Since(startedAt),
			},
		}, nil
	}

	rt.activity.Record(ActivityEntry{
		Type:     ActivityRequestReceived,
		RunID:    req.RunID,
		TaskID:   req.TaskID,
		AgentID:  req.AgentID,
		TenantID: req.TenantID,
		Message:  fmt.Sprintf("tool=%s depth=%d", req.Tool, req.Depth),
	})

	// 2. Lookup handler
	handlerVal, ok := rt.handlers.Load(req.AgentID)
	if !ok {
		return rt.failResult(req, startedAt, "AGENT_NOT_FOUND",
			fmt.Sprintf("agent %s is not registered", req.AgentID), false), nil
	}
	handler := handlerVal.(Handler)

	// 3. Guard: spawn depth
	if req.Depth > rt.config.MaxDepth {
		rt.activity.Record(ActivityEntry{
			Type:      ActivityGuardTriggered,
			RunID:     req.RunID,
			TaskID:    req.TaskID,
			AgentID:   req.AgentID,
			Message:   fmt.Sprintf("depth %d exceeds max %d", req.Depth, rt.config.MaxDepth),
			ErrorCode: "MAX_DEPTH_EXCEEDED",
		})
		return rt.failResult(req, startedAt, "MAX_DEPTH_EXCEEDED",
			fmt.Sprintf("spawn depth %d exceeds maximum %d", req.Depth, rt.config.MaxDepth), false), nil
	}

	// 4. Guard: spawn children count
	if req.ParentTaskID != "" {
		if !rt.acquireChildSlot(req.ParentTaskID) {
			rt.activity.Record(ActivityEntry{
				Type:      ActivitySpawnBlocked,
				RunID:     req.RunID,
				TaskID:    req.TaskID,
				AgentID:   req.AgentID,
				Message:   fmt.Sprintf("parent %s at child limit", req.ParentTaskID),
				ErrorCode: "MAX_CHILDREN_EXCEEDED",
			})
			return rt.failResult(req, startedAt, "MAX_CHILDREN_EXCEEDED",
				"maximum child agents exceeded for parent task", false), nil
		}
		defer rt.releaseChildSlot(req.ParentTaskID)
	}

	// 5. Acquire concurrency semaphore
	select {
	case rt.semaphore <- struct{}{}:
		defer func() { <-rt.semaphore }()
	case <-ctx.Done():
		return rt.failResult(req, startedAt, "CONCURRENCY_WAIT_CANCELED",
			"context canceled while waiting for execution slot", false), nil
	}

	rt.active.Add(1)
	defer rt.active.Add(-1)
	rt.total.Add(1)

	// 6. Resolve timeout
	timeout := rt.resolveTimeout(req)
	execCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// 7. Execute with retry
	spec, _ := rt.GetSpec(req.AgentID)
	maxRetries := rt.config.MaxRetries
	if spec.MaxRetries > 0 {
		maxRetries = spec.MaxRetries
	}

	rt.activity.Record(ActivityEntry{
		Type:    ActivityExecStarted,
		RunID:   req.RunID,
		TaskID:  req.TaskID,
		AgentID: req.AgentID,
		Message: fmt.Sprintf("tool=%s retries=%d timeout=%s", req.Tool, maxRetries, timeout),
	})

	var lastResult *Result
	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 100ms * 2^(attempt-1), capped at 10s
			delay := time.Duration(100<<uint(attempt-1)) * time.Millisecond
			if delay > 10*time.Second {
				delay = 10 * time.Second
			}

			rt.activity.Record(ActivityEntry{
				Type:    ActivityExecRetry,
				RunID:   req.RunID,
				TaskID:  req.TaskID,
				AgentID: req.AgentID,
				Message: fmt.Sprintf("attempt=%d delay=%s", attempt+1, delay),
				Fields:  map[string]string{"attempt": fmt.Sprintf("%d", attempt+1)},
			})

			select {
			case <-time.After(delay):
			case <-execCtx.Done():
				return rt.timeoutResult(req, startedAt), nil
			}
		}

		result, err := handler.Handle(execCtx, req)

		if err == nil && result != nil && result.Status == StatusSuccess {
			result.Metrics.StartedAt = startedAt
			result.Metrics.CompletedAt = time.Now().UTC()
			result.Metrics.Duration = time.Since(startedAt)
			result.Metrics.RetryCount = attempt

			rt.activity.Record(ActivityEntry{
				Type:     ActivityExecCompleted,
				RunID:    req.RunID,
				TaskID:   req.TaskID,
				AgentID:  req.AgentID,
				Status:   StatusSuccess,
				Duration: result.Metrics.Duration,
				Message:  fmt.Sprintf("attempt=%d", attempt+1),
			})

			return result, nil
		}

		lastResult = result
		lastErr = err

		// Check if retryable
		if err != nil {
			// Context errors are not retryable
			if execCtx.Err() != nil {
				return rt.timeoutResult(req, startedAt), nil
			}
			continue
		}

		if result != nil && result.Error != nil && !result.Error.Retryable {
			break
		}
	}

	// All retries exhausted
	completedAt := time.Now().UTC()

	if lastResult != nil {
		lastResult.Metrics.StartedAt = startedAt
		lastResult.Metrics.CompletedAt = completedAt
		lastResult.Metrics.Duration = completedAt.Sub(startedAt)
		lastResult.Metrics.RetryCount = maxRetries

		rt.activity.Record(ActivityEntry{
			Type:      ActivityExecFailed,
			RunID:     req.RunID,
			TaskID:    req.TaskID,
			AgentID:   req.AgentID,
			Status:    lastResult.Status,
			Duration:  completedAt.Sub(startedAt),
			ErrorCode: lastResult.Error.Code,
			Message:   lastResult.Error.Message,
		})

		return lastResult, nil
	}

	// Handler returned an error without a result
	errMsg := "unknown error"
	if lastErr != nil {
		errMsg = lastErr.Error()
	}

	rt.activity.Record(ActivityEntry{
		Type:      ActivityExecFailed,
		RunID:     req.RunID,
		TaskID:    req.TaskID,
		AgentID:   req.AgentID,
		Status:    StatusError,
		Duration:  completedAt.Sub(startedAt),
		ErrorCode: "HANDLER_ERROR",
		Message:   errMsg,
	})

	return &Result{
		TaskID: req.TaskID,
		Status: StatusError,
		Error:  &ExecError{Code: "HANDLER_ERROR", Message: errMsg, Retryable: false},
		Metrics: ExecMetrics{
			StartedAt:   startedAt,
			CompletedAt: completedAt,
			Duration:    completedAt.Sub(startedAt),
			RetryCount:  maxRetries,
		},
	}, nil
}

// Stats returns runtime statistics.
func (rt *Runtime) Stats() RuntimeStats {
	return RuntimeStats{
		ActiveExecutions: rt.active.Load(),
		TotalExecutions:  rt.total.Load(),
		MaxConcurrency:   rt.config.MaxConcurrency,
		ActivityLogSize:  rt.activity.Len(),
	}
}

// RuntimeStats contains runtime statistics.
type RuntimeStats struct {
	ActiveExecutions int64 `json:"active_executions"`
	TotalExecutions  int64 `json:"total_executions"`
	MaxConcurrency   int   `json:"max_concurrency"`
	ActivityLogSize  int   `json:"activity_log_size"`
}

// Activity returns the activity log for inspection.
func (rt *Runtime) Activity() *ActivityLog {
	return rt.activity
}

// resolveTimeout determines the effective timeout for a request.
func (rt *Runtime) resolveTimeout(req Request) time.Duration {
	timeout := rt.config.DefaultTimeout

	// Request-level override
	if req.Timeout > 0 {
		timeout = req.Timeout
	}

	// Spec-level override
	if spec, ok := rt.GetSpec(req.AgentID); ok && spec.Timeout > 0 {
		timeout = spec.Timeout
	}

	// Request-level override takes final priority
	if req.Timeout > 0 {
		timeout = req.Timeout
	}

	// Enforce ceiling
	if timeout > rt.config.MaxTimeout {
		timeout = rt.config.MaxTimeout
	}

	return timeout
}

// acquireChildSlot attempts to increment the child count for a parent task.
// Returns false if the parent is at its child limit.
func (rt *Runtime) acquireChildSlot(parentTaskID TaskID) bool {
	maxChildren := rt.config.MaxChildren

	for {
		val, _ := rt.spawnCounts.LoadOrStore(parentTaskID, new(atomic.Int32))
		counter := val.(*atomic.Int32)
		current := counter.Load()
		if int(current) >= maxChildren {
			return false
		}
		if counter.CompareAndSwap(current, current+1) {
			return true
		}
	}
}

// releaseChildSlot decrements the child count for a parent task.
func (rt *Runtime) releaseChildSlot(parentTaskID TaskID) {
	val, ok := rt.spawnCounts.Load(parentTaskID)
	if !ok {
		return
	}
	counter := val.(*atomic.Int32)
	counter.Add(-1)
}

// failResult constructs a failure result.
func (rt *Runtime) failResult(req Request, startedAt time.Time, code, message string, retryable bool) *Result {
	now := time.Now().UTC()
	return &Result{
		TaskID: req.TaskID,
		Status: StatusFailure,
		Error: &ExecError{
			Code:      code,
			Message:   message,
			Retryable: retryable,
		},
		Metrics: ExecMetrics{
			StartedAt:   startedAt,
			CompletedAt: now,
			Duration:    now.Sub(startedAt),
		},
	}
}

// timeoutResult constructs a timeout result.
func (rt *Runtime) timeoutResult(req Request, startedAt time.Time) *Result {
	now := time.Now().UTC()

	rt.activity.Record(ActivityEntry{
		Type:      ActivityExecTimeout,
		RunID:     req.RunID,
		TaskID:    req.TaskID,
		AgentID:   req.AgentID,
		Status:    StatusTimeout,
		Duration:  now.Sub(startedAt),
		ErrorCode: "TIMEOUT",
		Message:   "execution exceeded timeout",
	})

	return &Result{
		TaskID: req.TaskID,
		Status: StatusTimeout,
		Error: &ExecError{
			Code:      "TIMEOUT",
			Message:   "execution exceeded timeout",
			Retryable: true,
		},
		Metrics: ExecMetrics{
			StartedAt:   startedAt,
			CompletedAt: now,
			Duration:    now.Sub(startedAt),
		},
	}
}

// MarshalStats returns runtime stats as JSON.
func (rt *Runtime) MarshalStats() (json.RawMessage, error) {
	return json.Marshal(rt.Stats())
}
