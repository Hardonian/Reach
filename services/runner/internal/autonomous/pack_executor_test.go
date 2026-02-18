package autonomous

import (
	"context"
	"encoding/json"
	"testing"

	"reach/services/runner/internal/registry"
)

type spyExecutor struct {
	called bool
}

func (s *spyExecutor) Execute(_ context.Context, _ ExecutionEnvelope) (*ExecutionResult, error) {
	s.called = true
	return &ExecutionResult{Status: StatusSuccess}, nil
}

func signedPack(t *testing.T) registry.ExecutionPack {
	t.Helper()
	pack := registry.ExecutionPack{
		Metadata:            registry.PackMetadata{ID: "pack-a", Version: "1.0.0"},
		DeclaredTools:       []string{"tool.safe"},
		DeclaredPermissions: []string{},
		ModelRequirements:   map[string]string{"tier": "standard"},
		DeterministicFlag:   true,
	}
	hash, err := pack.ComputeHash()
	if err != nil {
		t.Fatal(err)
	}
	pack.SignatureHash = hash
	return pack
}

func TestPackExecutorReplaySnapshotGuardRejectsMismatch(t *testing.T) {
	delegate := &spyExecutor{}
	executor := NewOrchestrationPackExecutor(delegate, signedPack(t), PackExecutorOptions{ExpectedReplaySnapshotHash: "snapshot-a"})

	res, err := executor.Execute(context.Background(), ExecutionEnvelope{
		ID:       "env-1",
		ToolName: "tool.safe",
		Context: ExecutionContext{
			IsReplay:             true,
			RegistrySnapshotHash: "snapshot-b",
		},
		Arguments:   json.RawMessage(`{}`),
		Permissions: []string{},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Error == nil || res.Error.Code != "REPLAY_SNAPSHOT_MISMATCH" {
		t.Fatalf("expected replay snapshot mismatch error, got %+v", res.Error)
	}
	if delegate.called {
		t.Fatal("delegate should not be called when snapshot guard fails")
	}
}

func TestPackExecutorReplaySnapshotGuardAllowsMatchingSnapshot(t *testing.T) {
	delegate := &spyExecutor{}
	executor := NewOrchestrationPackExecutor(delegate, signedPack(t), PackExecutorOptions{ExpectedReplaySnapshotHash: "snapshot-a"})

	res, err := executor.Execute(context.Background(), ExecutionEnvelope{
		ID:       "env-1",
		ToolName: "tool.safe",
		Context: ExecutionContext{
			IsReplay:             true,
			RegistrySnapshotHash: "snapshot-a",
		},
		Arguments:   json.RawMessage(`{}`),
		Permissions: []string{},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != StatusSuccess {
		t.Fatalf("expected success status, got %s", res.Status)
	}
	if !delegate.called {
		t.Fatal("expected delegate to be called")
	}
}
