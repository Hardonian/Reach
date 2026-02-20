package agents

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"
	"time"
)

func newTestBridge(t *testing.T) (*Bridge, *Runtime) {
	t.Helper()
	var buf bytes.Buffer
	rt, err := NewRuntime(testConfig(), WithWriter(&buf))
	if err != nil {
		t.Fatal(err)
	}
	bridge := NewBridge(rt, BridgeConfig{
		TenantID: "tenant-test",
		RunID:    "run-test",
	})
	return bridge, rt
}

func TestBridgeInvoke(t *testing.T) {
	bridge, rt := newTestBridge(t)
	spec := testSpec("bridge-agent")
	rt.Register(spec, successHandler())

	result, err := bridge.Invoke(context.Background(), "bridge-agent", "do-thing", json.RawMessage(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != StatusSuccess {
		t.Errorf("expected success, got %s", result.Status)
	}
}

func TestBridgeInvokeWithOptions(t *testing.T) {
	bridge, rt := newTestBridge(t)

	var capturedReq Request
	rt.Register(testSpec("opts-agent"), HandlerFunc(func(ctx context.Context, req Request) (*Result, error) {
		capturedReq = req
		return &Result{TaskID: req.TaskID, Status: StatusSuccess}, nil
	}))

	_, err := bridge.Invoke(context.Background(), "opts-agent", "tool",
		json.RawMessage(`{}`),
		WithRunID("custom-run"),
		WithPermissions("read", "write"),
		WithMetadata(map[string]string{"env": "test"}),
	)
	if err != nil {
		t.Fatal(err)
	}

	if capturedReq.RunID != "custom-run" {
		t.Errorf("expected custom-run, got %s", capturedReq.RunID)
	}
	if len(capturedReq.Permissions) != 2 {
		t.Errorf("expected 2 permissions, got %d", len(capturedReq.Permissions))
	}
	if capturedReq.Metadata["env"] != "test" {
		t.Error("expected metadata env=test")
	}
}

func TestBridgeInvokeBatch(t *testing.T) {
	bridge, rt := newTestBridge(t)
	rt.Register(testSpec("batch-agent"), successHandler())

	requests := []BatchRequest{
		{AgentID: "batch-agent", Tool: "tool-1", Arguments: json.RawMessage(`{}`)},
		{AgentID: "batch-agent", Tool: "tool-2", Arguments: json.RawMessage(`{}`)},
		{AgentID: "batch-agent", Tool: "tool-3", Arguments: json.RawMessage(`{}`)},
	}

	results := bridge.InvokeBatch(context.Background(), requests)

	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}

	for i, r := range results {
		if r.Result == nil {
			t.Errorf("result %d is nil", i)
			continue
		}
		if r.Result.Status != StatusSuccess {
			t.Errorf("result %d expected success, got %s", i, r.Result.Status)
		}
	}
}

func TestBridgeInvokeWithTimeout(t *testing.T) {
	cfg := testConfig()
	cfg.DefaultTimeout = 100 * time.Millisecond
	cfg.MaxTimeout = 200 * time.Millisecond
	cfg.MaxRetries = 0

	var buf bytes.Buffer
	rt, _ := NewRuntime(cfg, WithWriter(&buf))
	bridge := NewBridge(rt, BridgeConfig{TenantID: "t", RunID: "r"})

	rt.Register(testSpec("slow-agent"), HandlerFunc(func(ctx context.Context, req Request) (*Result, error) {
		select {
		case <-time.After(5 * time.Second):
			return &Result{TaskID: req.TaskID, Status: StatusSuccess}, nil
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}))

	result, _ := bridge.Invoke(context.Background(), "slow-agent", "slow-tool",
		json.RawMessage(`{}`),
		WithInvokeTimeout(50*time.Millisecond),
	)

	if result.Status != StatusTimeout {
		t.Errorf("expected timeout, got %s", result.Status)
	}
}

func TestToCLIResult(t *testing.T) {
	r := &Result{
		TaskID: "task-1",
		Status: StatusSuccess,
		Output: json.RawMessage(`{"data": 42}`),
		Metrics: ExecMetrics{
			Duration:   100 * time.Millisecond,
			RetryCount: 1,
		},
	}

	cli := ToCLIResult(r)
	if cli.Status != "success" {
		t.Errorf("expected success, got %s", cli.Status)
	}
	if cli.Error != "" {
		t.Errorf("expected no error, got %s", cli.Error)
	}
	if cli.Retries != 1 {
		t.Errorf("expected 1 retry, got %d", cli.Retries)
	}

	// With error
	r2 := &Result{
		TaskID: "task-2",
		Status: StatusFailure,
		Error:  &ExecError{Code: "BOOM", Message: "something broke"},
		Metrics: ExecMetrics{
			Duration: 50 * time.Millisecond,
		},
	}
	cli2 := ToCLIResult(r2)
	if cli2.Error != "[BOOM] something broke" {
		t.Errorf("unexpected error format: %s", cli2.Error)
	}
}

func TestBridgeWithParent(t *testing.T) {
	bridge, rt := newTestBridge(t)

	var capturedReq Request
	rt.Register(testSpec("child-agent"), HandlerFunc(func(ctx context.Context, req Request) (*Result, error) {
		capturedReq = req
		return &Result{TaskID: req.TaskID, Status: StatusSuccess}, nil
	}))

	_, err := bridge.Invoke(context.Background(), "child-agent", "tool",
		json.RawMessage(`{}`),
		WithParent("parent-123", 2),
	)
	if err != nil {
		t.Fatal(err)
	}

	if capturedReq.ParentTaskID != "parent-123" {
		t.Errorf("expected parent-123, got %s", capturedReq.ParentTaskID)
	}
	if capturedReq.Depth != 2 {
		t.Errorf("expected depth 2, got %d", capturedReq.Depth)
	}
}
