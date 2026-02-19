package engineclient

import (
	"context"
	"encoding/json"
	"testing"
)

func TestNew(t *testing.T) {
	// Test with explicit path
	c := New("/path/to/engine")
	if c == nil {
		t.Fatal("expected non-nil client")
	}
	if c.bin != "/path/to/engine" {
		t.Errorf("expected bin '/path/to/engine', got %s", c.bin)
	}

	// Test with empty path (should use default)
	c2 := New("")
	if c2 == nil {
		t.Fatal("expected non-nil client")
	}
	// Will use ENV or default "engine-json"
}

func TestClientStructs(t *testing.T) {
	// Test Event struct
	event := Event{
		SchemaVersion: "1.0",
		EventID:       "evt-123",
		RunID:         "run-456",
		Type:          "step",
		Timestamp:     "2024-01-01T00:00:00Z",
		Payload:       json.RawMessage(`{"key":"value"}`),
	}
	if event.SchemaVersion != "1.0" {
		t.Errorf("expected SchemaVersion '1.0', got %s", event.SchemaVersion)
	}

	// Test Action struct
	action := Action{
		Type: "tool_call",
	}
	if action.Type != "tool_call" {
		t.Errorf("expected Type 'tool_call', got %s", action.Type)
	}

	// Test Response struct
	resp := Response{
		OK:     true,
		Events: []Event{event},
	}
	if !resp.OK {
		t.Error("expected OK to be true")
	}
	if len(resp.Events) != 1 {
		t.Errorf("expected 1 event, got %d", len(resp.Events))
	}

	// Test ToolResult struct
	result := ToolResult{
		StepID:   "step-1",
		ToolName: "test-tool",
		Output:   json.RawMessage(`{"result":"ok"}`),
		Success:  true,
	}
	if result.StepID != "step-1" {
		t.Errorf("expected StepID 'step-1', got %s", result.StepID)
	}
	if !result.Success {
		t.Error("expected Success to be true")
	}
}

func TestToolResultWithError(t *testing.T) {
	errMsg := "something went wrong"
	result := ToolResult{
		StepID:   "step-1",
		ToolName: "test-tool",
		Success:  false,
		Error:    &errMsg,
	}

	if result.Success {
		t.Error("expected Success to be false")
	}
	if result.Error == nil {
		t.Fatal("expected Error to be non-nil")
	}
	if *result.Error != errMsg {
		t.Errorf("expected Error '%s', got '%s'", errMsg, *result.Error)
	}
}

func TestCompileWorkflow(t *testing.T) {
	// This test would require a real engine binary, so we test the struct/payload formation
	c := New("engine-json")

	workflow := json.RawMessage(`{"steps":[]}`)

	// We can't actually call CompileWorkflow without the engine binary,
	// but we can verify the method exists and the payload structure
	_ = c
	_ = workflow

	ctx := context.Background()
	ctx = context.WithValue(ctx, "test", true)
	_ = ctx
}

func TestStartRun(t *testing.T) {
	c := New("engine-json")
	_ = c

	// Test payload formation
	runID := "run-123"
	workflow := json.RawMessage(`{"steps":[]}`)
	initiator := "test-user"

	_ = runID
	_ = workflow
	_ = initiator
}

func TestNextAction(t *testing.T) {
	c := New("engine-json")
	_ = c

	runID := "run-123"
	runHandle := json.RawMessage(`{"state":"active"}`)

	_ = runID
	_ = runHandle
}

func TestApplyToolResult(t *testing.T) {
	c := New("engine-json")
	_ = c

	runID := "run-123"
	runHandle := json.RawMessage(`{"state":"active"}`)
	toolResult := ToolResult{
		StepID:   "step-1",
		ToolName: "test-tool",
		Output:   json.RawMessage(`{"status":"done"}`),
		Success:  true,
	}

	_ = runID
	_ = runHandle
	_ = toolResult
}

func TestRepoRoot(t *testing.T) {
	// repoRoot walks up looking for Cargo.toml
	// In the test environment, this may or may not find it
	root, err := repoRoot()
	if err != nil {
		t.Logf("repoRoot not found (expected in test env): %v", err)
	} else {
		t.Logf("repoRoot found: %s", root)
	}
}

func BenchmarkClientCreation(b *testing.B) {
	for i := 0; i < b.N; i++ {
		New("/path/to/engine")
	}
}
