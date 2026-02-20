package agents

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func testConfig() RuntimeConfig {
	return RuntimeConfig{
		DefaultTimeout:   5 * time.Second,
		MaxTimeout:       30 * time.Second,
		MaxDepth:         3,
		MaxChildren:      5,
		MaxConcurrency:   10,
		MaxRetries:       2,
		MaxMemoryEntries: 1000,
	}
}

func testSpec(id AgentID) AgentSpec {
	return AgentSpec{
		ID:      id,
		Name:    string(id),
		Version: "1.0.0",
	}
}

func testRequest(agentID AgentID) Request {
	return Request{
		RunID:    "run-1",
		TaskID:   TaskID(fmt.Sprintf("task-%s", agentID)),
		AgentID:  agentID,
		TenantID: "tenant-1",
		Tool:     "test-tool",
	}
}

func successHandler() Handler {
	return HandlerFunc(func(ctx context.Context, req Request) (*Result, error) {
		return &Result{
			TaskID: req.TaskID,
			Status: StatusSuccess,
			Output: json.RawMessage(`{"ok":true}`),
		}, nil
	})
}

func failHandler(code string, retryable bool) Handler {
	return HandlerFunc(func(ctx context.Context, req Request) (*Result, error) {
		return &Result{
			TaskID: req.TaskID,
			Status: StatusFailure,
			Error:  &ExecError{Code: code, Message: "test failure", Retryable: retryable},
		}, nil
	})
}

func errorHandler() Handler {
	return HandlerFunc(func(ctx context.Context, req Request) (*Result, error) {
		return nil, errors.New("handler exploded")
	})
}

func newTestRuntime(t *testing.T) *Runtime {
	t.Helper()
	var buf bytes.Buffer
	rt, err := NewRuntime(testConfig(), WithWriter(&buf))
	if err != nil {
		t.Fatal(err)
	}
	return rt
}

func TestRuntimeCreation(t *testing.T) {
	rt, err := NewRuntime(DefaultRuntimeConfig())
	if err != nil {
		t.Fatal(err)
	}
	stats := rt.Stats()
	if stats.ActiveExecutions != 0 {
		t.Errorf("expected 0 active, got %d", stats.ActiveExecutions)
	}
}

func TestRuntimeInvalidConfig(t *testing.T) {
	cfg := RuntimeConfig{} // All zeros
	_, err := NewRuntime(cfg)
	if err == nil {
		t.Fatal("expected error for invalid config")
	}
}

func TestRegisterAndExecute(t *testing.T) {
	rt := newTestRuntime(t)
	spec := testSpec("agent-a")
	if err := rt.Register(spec, successHandler()); err != nil {
		t.Fatal(err)
	}

	req := testRequest("agent-a")
	result, err := rt.Execute(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != StatusSuccess {
		t.Errorf("expected success, got %s", result.Status)
	}
	if result.Metrics.Duration < 0 {
		t.Error("expected non-negative duration")
	}

	stats := rt.Stats()
	if stats.TotalExecutions != 1 {
		t.Errorf("expected 1 total execution, got %d", stats.TotalExecutions)
	}
}

func TestExecuteUnregisteredAgent(t *testing.T) {
	rt := newTestRuntime(t)
	req := testRequest("nonexistent")

	result, err := rt.Execute(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != StatusFailure {
		t.Errorf("expected failure, got %s", result.Status)
	}
	if result.Error.Code != "AGENT_NOT_FOUND" {
		t.Errorf("expected AGENT_NOT_FOUND, got %s", result.Error.Code)
	}
}

func TestValidationFailure(t *testing.T) {
	rt := newTestRuntime(t)
	req := Request{} // Missing required fields

	result, err := rt.Execute(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != StatusError {
		t.Errorf("expected error status, got %s", result.Status)
	}
	if result.Error.Code != "VALIDATION_FAILED" {
		t.Errorf("expected VALIDATION_FAILED, got %s", result.Error.Code)
	}
}

func TestMaxDepthGuard(t *testing.T) {
	rt := newTestRuntime(t)
	spec := testSpec("agent-deep")
	rt.Register(spec, successHandler())

	req := testRequest("agent-deep")
	req.Depth = 100 // Exceeds MaxDepth of 3

	result, err := rt.Execute(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if result.Error.Code != "MAX_DEPTH_EXCEEDED" {
		t.Errorf("expected MAX_DEPTH_EXCEEDED, got %s", result.Error.Code)
	}
}

func TestMaxChildrenGuard(t *testing.T) {
	rt := newTestRuntime(t)
	spec := testSpec("agent-child")
	rt.Register(spec, HandlerFunc(func(ctx context.Context, req Request) (*Result, error) {
		// Hold execution open until context is done
		<-ctx.Done()
		return &Result{TaskID: req.TaskID, Status: StatusCanceled}, nil
	}))

	parentTaskID := TaskID("parent-task")
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Fill up child slots (MaxChildren = 5)
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			req := Request{
				RunID:        "run-1",
				TaskID:       TaskID(fmt.Sprintf("child-%d", i)),
				AgentID:      "agent-child",
				TenantID:     "tenant-1",
				Tool:         "test-tool",
				ParentTaskID: parentTaskID,
				Depth:        1,
			}
			rt.Execute(ctx, req)
		}(i)
	}

	// Give goroutines time to start
	time.Sleep(50 * time.Millisecond)

	// 6th child should be blocked
	req := Request{
		RunID:        "run-1",
		TaskID:       "child-overflow",
		AgentID:      "agent-child",
		TenantID:     "tenant-1",
		Tool:         "test-tool",
		ParentTaskID: parentTaskID,
		Depth:        1,
	}
	result, _ := rt.Execute(context.Background(), req)
	if result.Error == nil || result.Error.Code != "MAX_CHILDREN_EXCEEDED" {
		t.Errorf("expected MAX_CHILDREN_EXCEEDED, got %v", result.Error)
	}

	cancel()
	wg.Wait()
}

func TestRetryOnError(t *testing.T) {
	rt := newTestRuntime(t)
	spec := testSpec("agent-retry")
	rt.Register(spec, errorHandler())

	req := testRequest("agent-retry")
	result, _ := rt.Execute(context.Background(), req)

	if result.Status != StatusError {
		t.Errorf("expected error, got %s", result.Status)
	}
	if result.Metrics.RetryCount != 2 { // MaxRetries = 2
		t.Errorf("expected 2 retries, got %d", result.Metrics.RetryCount)
	}
}

func TestRetryStopsOnNonRetryable(t *testing.T) {
	rt := newTestRuntime(t)
	spec := testSpec("agent-noretry")

	var attempts atomic.Int32
	rt.Register(spec, HandlerFunc(func(ctx context.Context, req Request) (*Result, error) {
		attempts.Add(1)
		return &Result{
			TaskID: req.TaskID,
			Status: StatusFailure,
			Error:  &ExecError{Code: "FATAL", Message: "non-retryable", Retryable: false},
		}, nil
	}))

	req := testRequest("agent-noretry")
	result, _ := rt.Execute(context.Background(), req)

	if result.Error.Code != "FATAL" {
		t.Errorf("expected FATAL, got %s", result.Error.Code)
	}
	if attempts.Load() != 1 {
		t.Errorf("expected 1 attempt (no retries), got %d", attempts.Load())
	}
}

func TestTimeoutEnforcement(t *testing.T) {
	cfg := testConfig()
	cfg.DefaultTimeout = 100 * time.Millisecond
	cfg.MaxTimeout = 200 * time.Millisecond
	cfg.MaxRetries = 0

	var buf bytes.Buffer
	rt, err := NewRuntime(cfg, WithWriter(&buf))
	if err != nil {
		t.Fatal(err)
	}

	spec := testSpec("agent-slow")
	rt.Register(spec, HandlerFunc(func(ctx context.Context, req Request) (*Result, error) {
		select {
		case <-time.After(5 * time.Second):
			return &Result{TaskID: req.TaskID, Status: StatusSuccess}, nil
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}))

	req := testRequest("agent-slow")
	result, _ := rt.Execute(context.Background(), req)

	if result.Status != StatusTimeout {
		t.Errorf("expected timeout, got %s", result.Status)
	}
}

func TestMaxTimeoutCeiling(t *testing.T) {
	rt := newTestRuntime(t)
	spec := testSpec("agent-long")
	rt.Register(spec, successHandler())

	req := testRequest("agent-long")
	req.Timeout = 999 * time.Hour // Way over MaxTimeout

	result, _ := rt.Execute(context.Background(), req)
	if result.Status != StatusSuccess {
		t.Errorf("expected success, got %s", result.Status)
	}
	// The important thing is it didn't hang — the ceiling was applied
}

func TestConcurrencyLimit(t *testing.T) {
	cfg := testConfig()
	cfg.MaxConcurrency = 2
	cfg.MaxRetries = 0

	var buf bytes.Buffer
	rt, _ := NewRuntime(cfg, WithWriter(&buf))

	var active atomic.Int32
	var maxActive atomic.Int32

	spec := testSpec("agent-conc")
	rt.Register(spec, HandlerFunc(func(ctx context.Context, req Request) (*Result, error) {
		cur := active.Add(1)
		defer active.Add(-1)

		for {
			prev := maxActive.Load()
			if cur <= prev {
				break
			}
			if maxActive.CompareAndSwap(prev, cur) {
				break
			}
		}

		time.Sleep(50 * time.Millisecond)
		return &Result{TaskID: req.TaskID, Status: StatusSuccess}, nil
	}))

	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			req := Request{
				RunID:    "run-1",
				TaskID:   TaskID(fmt.Sprintf("task-%d", i)),
				AgentID:  "agent-conc",
				TenantID: "tenant-1",
				Tool:     "test-tool",
			}
			rt.Execute(context.Background(), req)
		}(i)
	}
	wg.Wait()

	if maxActive.Load() > 2 {
		t.Errorf("expected max 2 concurrent, got %d", maxActive.Load())
	}
}

func TestActivityLogRecordsExecution(t *testing.T) {
	rt := newTestRuntime(t)
	spec := testSpec("agent-log")
	rt.Register(spec, successHandler())

	req := testRequest("agent-log")
	rt.Execute(context.Background(), req)

	entries := rt.Activity().EntriesForTask(req.TaskID)
	if len(entries) < 3 {
		t.Fatalf("expected at least 3 activity entries, got %d", len(entries))
	}

	// Check entry types
	types := make(map[ActivityType]bool)
	for _, e := range entries {
		types[e.Type] = true
		if e.ID == "" {
			t.Error("expected deterministic ID on entry")
		}
		if e.RunID != req.RunID {
			t.Errorf("expected run ID %s, got %s", req.RunID, e.RunID)
		}
	}

	if !types[ActivityRequestReceived] {
		t.Error("missing request.received entry")
	}
	if !types[ActivityExecStarted] {
		t.Error("missing execution.started entry")
	}
	if !types[ActivityExecCompleted] {
		t.Error("missing execution.completed entry")
	}
}

func TestActivityLogRingBuffer(t *testing.T) {
	var buf bytes.Buffer
	al := NewActivityLog(WithWriter(&buf), WithMaxEntries(5))

	for i := 0; i < 10; i++ {
		al.Record(ActivityEntry{
			Type:    ActivityExecStarted,
			RunID:   RunID(fmt.Sprintf("run-%d", i)),
			TaskID:  TaskID(fmt.Sprintf("task-%d", i)),
			AgentID: "agent",
		})
	}

	if al.Len() != 5 {
		t.Errorf("expected 5 entries after eviction, got %d", al.Len())
	}

	// Should have the last 5 entries (run-5 through run-9)
	entries := al.Entries()
	if entries[0].RunID != "run-5" {
		t.Errorf("expected first entry to be run-5, got %s", entries[0].RunID)
	}
}

func TestContextCancellation(t *testing.T) {
	rt := newTestRuntime(t)
	spec := testSpec("agent-cancel")

	rt.Register(spec, HandlerFunc(func(ctx context.Context, req Request) (*Result, error) {
		<-ctx.Done()
		return nil, ctx.Err()
	}))

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	req := testRequest("agent-cancel")
	result, _ := rt.Execute(ctx, req)

	// Pre-canceled context should result in a terminal status
	if !result.Status.IsTerminal() {
		t.Errorf("expected terminal status from canceled ctx, got %s", result.Status)
	}
}

func TestRegistryOperations(t *testing.T) {
	rt := newTestRuntime(t)
	reg := NewRegistry(rt)

	spec := testSpec("reg-agent")
	if err := reg.Register(spec, successHandler()); err != nil {
		t.Fatal(err)
	}

	if !reg.Has("reg-agent") {
		t.Error("expected agent to be registered")
	}

	if reg.Count() != 1 {
		t.Errorf("expected count 1, got %d", reg.Count())
	}

	specs := reg.List()
	if len(specs) != 1 || specs[0].ID != "reg-agent" {
		t.Error("unexpected spec list")
	}

	got, ok := reg.Get("reg-agent")
	if !ok {
		t.Fatal("expected to find agent")
	}
	if got.Name != "reg-agent" {
		t.Errorf("unexpected name: %s", got.Name)
	}

	// Duplicate registration should fail
	err := reg.Register(spec, successHandler())
	if err == nil {
		t.Error("expected error on duplicate registration")
	}

	reg.Unregister("reg-agent")
	if reg.Has("reg-agent") {
		t.Error("expected agent to be unregistered")
	}
}

func TestRuntimeConfigValidation(t *testing.T) {
	tests := []struct {
		name    string
		modify  func(RuntimeConfig) RuntimeConfig
		wantErr bool
	}{
		{
			name:    "valid default config",
			modify:  func(c RuntimeConfig) RuntimeConfig { return c },
			wantErr: false,
		},
		{
			name:    "zero default timeout",
			modify:  func(c RuntimeConfig) RuntimeConfig { c.DefaultTimeout = 0; return c },
			wantErr: true,
		},
		{
			name:    "zero max timeout",
			modify:  func(c RuntimeConfig) RuntimeConfig { c.MaxTimeout = 0; return c },
			wantErr: true,
		},
		{
			name:    "max timeout less than default",
			modify:  func(c RuntimeConfig) RuntimeConfig { c.MaxTimeout = time.Millisecond; c.DefaultTimeout = time.Second; return c },
			wantErr: true,
		},
		{
			name:    "zero max depth",
			modify:  func(c RuntimeConfig) RuntimeConfig { c.MaxDepth = 0; return c },
			wantErr: true,
		},
		{
			name:    "zero max children",
			modify:  func(c RuntimeConfig) RuntimeConfig { c.MaxChildren = 0; return c },
			wantErr: true,
		},
		{
			name:    "zero max concurrency",
			modify:  func(c RuntimeConfig) RuntimeConfig { c.MaxConcurrency = 0; return c },
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := tt.modify(DefaultRuntimeConfig())
			err := cfg.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
