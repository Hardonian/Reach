package jobs

import "testing"

func TestCreateRunSequentialID(t *testing.T) {
	store := NewStore()
	r1 := store.CreateRun()
	r2 := store.CreateRun()

	if r1.ID != "run-000001" {
		t.Fatalf("unexpected first id: %s", r1.ID)
	}
	if r2.ID != "run-000002" {
		t.Fatalf("unexpected second id: %s", r2.ID)
	}
}

func TestPublishEventUnknownRun(t *testing.T) {
	store := NewStore()
	if err := store.PublishEvent("missing", Event{Type: "x"}); err != ErrRunNotFound {
		t.Fatalf("expected ErrRunNotFound, got %v", err)
	}
}
