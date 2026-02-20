package agents

import (
	"context"
	"encoding/json"
	"testing"
)

func TestAgentSpecValidation(t *testing.T) {
	tests := []struct {
		name    string
		spec    AgentSpec
		wantErr bool
	}{
		{
			name:    "valid spec",
			spec:    AgentSpec{ID: "test-agent", Name: "Test Agent", Version: "1.0.0"},
			wantErr: false,
		},
		{
			name:    "missing ID",
			spec:    AgentSpec{Name: "Test", Version: "1.0.0"},
			wantErr: true,
		},
		{
			name:    "missing name",
			spec:    AgentSpec{ID: "test", Version: "1.0.0"},
			wantErr: true,
		},
		{
			name:    "missing version",
			spec:    AgentSpec{ID: "test", Name: "Test"},
			wantErr: true,
		},
		{
			name:    "negative max concurrency",
			spec:    AgentSpec{ID: "test", Name: "Test", Version: "1.0.0", MaxConcurrency: -1},
			wantErr: true,
		},
		{
			name:    "negative max retries",
			spec:    AgentSpec{ID: "test", Name: "Test", Version: "1.0.0", MaxRetries: -1},
			wantErr: true,
		},
		{
			name:    "negative max depth",
			spec:    AgentSpec{ID: "test", Name: "Test", Version: "1.0.0", MaxDepth: -1},
			wantErr: true,
		},
		{
			name:    "negative max children",
			spec:    AgentSpec{ID: "test", Name: "Test", Version: "1.0.0", MaxChildren: -1},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.spec.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestRequestValidation(t *testing.T) {
	validReq := Request{
		RunID:    "run-1",
		TaskID:   "task-1",
		AgentID:  "agent-1",
		TenantID: "tenant-1",
		Tool:     "tool-1",
	}

	tests := []struct {
		name    string
		modify  func(Request) Request
		wantErr bool
	}{
		{
			name:    "valid request",
			modify:  func(r Request) Request { return r },
			wantErr: false,
		},
		{
			name:    "missing run ID",
			modify:  func(r Request) Request { r.RunID = ""; return r },
			wantErr: true,
		},
		{
			name:    "missing task ID",
			modify:  func(r Request) Request { r.TaskID = ""; return r },
			wantErr: true,
		},
		{
			name:    "missing agent ID",
			modify:  func(r Request) Request { r.AgentID = ""; return r },
			wantErr: true,
		},
		{
			name:    "missing tenant ID",
			modify:  func(r Request) Request { r.TenantID = ""; return r },
			wantErr: true,
		},
		{
			name:    "missing tool",
			modify:  func(r Request) Request { r.Tool = ""; return r },
			wantErr: true,
		},
		{
			name:    "negative depth",
			modify:  func(r Request) Request { r.Depth = -1; return r },
			wantErr: true,
		},
		{
			name:    "invalid JSON arguments",
			modify:  func(r Request) Request { r.Arguments = json.RawMessage(`{broken}`); return r },
			wantErr: true,
		},
		{
			name:    "valid JSON arguments",
			modify:  func(r Request) Request { r.Arguments = json.RawMessage(`{"key":"value"}`); return r },
			wantErr: false,
		},
		{
			name:    "nil arguments allowed",
			modify:  func(r Request) Request { r.Arguments = nil; return r },
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := tt.modify(validReq)
			err := req.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestStatusIsTerminal(t *testing.T) {
	terminal := []Status{StatusSuccess, StatusFailure, StatusError, StatusTimeout, StatusCanceled}
	nonTerminal := []Status{StatusPending, StatusRunning}

	for _, s := range terminal {
		if !s.IsTerminal() {
			t.Errorf("expected %s to be terminal", s)
		}
	}
	for _, s := range nonTerminal {
		if s.IsTerminal() {
			t.Errorf("expected %s to be non-terminal", s)
		}
	}
}

func TestExecErrorInterface(t *testing.T) {
	err := &ExecError{Code: "TEST", Message: "test error"}
	if err.Error() != "TEST: test error" {
		t.Errorf("unexpected error string: %s", err.Error())
	}
}

func TestHandlerFunc(t *testing.T) {
	called := false
	h := HandlerFunc(func(ctx context.Context, req Request) (*Result, error) {
		called = true
		return &Result{TaskID: req.TaskID, Status: StatusSuccess}, nil
	})

	result, err := h.Handle(nil, Request{TaskID: "t1"})
	if err != nil {
		t.Fatal(err)
	}
	if !called {
		t.Error("handler not called")
	}
	if result.Status != StatusSuccess {
		t.Errorf("expected success, got %s", result.Status)
	}
}
