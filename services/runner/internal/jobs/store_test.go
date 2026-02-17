package jobs

import (
	"errors"
	"testing"
)

func TestCreateRunSequentialID(t *testing.T) {
	store := NewStore(NewFileAuditLogger(t.TempDir()))
	r1 := store.CreateRun("req-1", []string{"tool:echo"})
	r2 := store.CreateRun("req-2", []string{"tool:echo"})

	if r1.ID != "run-000001" {
		t.Fatalf("unexpected first id: %s", r1.ID)
	}
	if r2.ID != "run-000002" {
		t.Fatalf("unexpected second id: %s", r2.ID)
	}
}

func TestPublishEventUnknownRun(t *testing.T) {
	store := NewStore(NewFileAuditLogger(t.TempDir()))
	if err := store.PublishEvent("missing", Event{Type: "x"}, "req-1"); err != ErrRunNotFound {
		t.Fatalf("expected ErrRunNotFound, got %v", err)
	}
}

func TestCheckCapabilities(t *testing.T) {
	store := NewStore(NewFileAuditLogger(t.TempDir()))
	run := store.CreateRun("req-1", []string{"tool:echo", "tool:read"})
	if err := store.CheckCapabilities(run.ID, []string{"tool:echo"}); err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if err := store.CheckCapabilities(run.ID, []string{"tool:danger"}); !errors.Is(err, ErrCapabilityDenied) {
		t.Fatalf("expected ErrCapabilityDenied, got %v", err)
	}
}
