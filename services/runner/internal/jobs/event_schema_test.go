package jobs

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"reach/services/runner/internal/storage"
)

func TestAppendEventInjectsSchemaVersion(t *testing.T) {
	db, err := storage.NewSQLiteStore(t.TempDir() + "/runner.sqlite")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store := NewStore(db)
	run, err := store.CreateRun(context.Background(), "tenant-a", nil)
	if err != nil {
		t.Fatal(err)
	}

	_, err = store.AppendEvent(context.Background(), run.ID, Event{Type: "tool.result", Payload: []byte(`{"tool":"echo"}`), CreatedAt: time.Now().UTC()})
	if err != nil {
		t.Fatal(err)
	}

	events, err := store.EventHistory(context.Background(), "tenant-a", run.ID, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	var payload map[string]any
	if err := json.Unmarshal(events[0].Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["schemaVersion"] != protocolSchemaVersion {
		t.Fatalf("expected schemaVersion %s, got %#v", protocolSchemaVersion, payload["schemaVersion"])
	}
}

func TestAppendEventRejectsMalformedPayload(t *testing.T) {
	db, err := storage.NewSQLiteStore(t.TempDir() + "/runner.sqlite")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store := NewStore(db)
	run, err := store.CreateRun(context.Background(), "tenant-a", nil)
	if err != nil {
		t.Fatal(err)
	}

	_, err = store.AppendEvent(context.Background(), run.ID, Event{Type: "tool.result", Payload: []byte(`{"schemaVersion":"1.0.0"`), CreatedAt: time.Now().UTC()})
	if err == nil || !strings.Contains(err.Error(), "invalid event payload") {
		t.Fatalf("expected malformed payload error, got %v", err)
	}
}
