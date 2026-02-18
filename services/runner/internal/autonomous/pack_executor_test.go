package autonomous

import (
	"context"
	"encoding/json"
	"testing"

	"reach/services/runner/internal/registry"
)

type passthroughExecutor struct{}

func (passthroughExecutor) Execute(_ context.Context, envelope ExecutionEnvelope) (*ExecutionResult, error) {
	return &ExecutionResult{EnvelopeID: envelope.ID, Status: StatusSuccess}, nil
}

func signedPack(t *testing.T) registry.ExecutionPack {
	t.Helper()
	pack := registry.ExecutionPack{
		Metadata:            registry.PackMetadata{ID: "pack-1", Version: "1.0.0"},
		DeclaredTools:       []string{"tool.safe"},
		DeclaredPermissions: []string{"net:read"},
	}
	h, err := pack.ComputeHash()
	if err != nil {
		t.Fatal(err)
	}
	pack.SignatureHash = h
	return pack
}

func TestPackExecutorReportsReplaySnapshotMismatch(t *testing.T) {
	pack := signedPack(t)
	var gotCode, gotMessage string
	exec := NewPackExecutor(
		passthroughExecutor{},
		pack,
		WithSnapshotHash("snapshot-runtime"),
		WithInvariantReporter(func(_ context.Context, code, message string) {
			gotCode = code
			gotMessage = message
		}),
	)

	res, err := exec.Execute(context.Background(), ExecutionEnvelope{
		ID:          "env-1",
		ToolName:    "tool.safe",
		Arguments:   json.RawMessage(`{}`),
		Permissions: []string{"net:read"},
		Context: ExecutionContext{
			IsReplay:             true,
			PackHash:             pack.SignatureHash,
			RegistrySnapshotHash: "snapshot-replay",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != StatusError {
		t.Fatalf("expected error status, got %s", res.Status)
	}
	if gotCode != "REPLAY_SNAPSHOT_MISMATCH" {
		t.Fatalf("expected REPLAY_SNAPSHOT_MISMATCH, got %s", gotCode)
	}
	if gotMessage == "" {
		t.Fatal("expected invariant message")
	}
}

func TestNewOrchestrationPackExecutorWiresReporter(t *testing.T) {
	pack := signedPack(t)
	called := false
	exec := NewOrchestrationPackExecutor(passthroughExecutor{}, pack, "snapshot-runtime", func(_ context.Context, code, _ string) {
		if code == "TOOL_DENIED" {
			called = true
		}
	})

	res, err := exec.Execute(context.Background(), ExecutionEnvelope{
		ID:          "env-2",
		ToolName:    "tool.blocked",
		Arguments:   json.RawMessage(`{}`),
		Permissions: []string{"net:read"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != StatusError {
		t.Fatalf("expected status error, got %s", res.Status)
	}
	if !called {
		t.Fatal("expected invariant reporter to be invoked")
	}
}
