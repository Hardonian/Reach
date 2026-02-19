package jobs

import (
	"context"
	"testing"
	"time"

	"reach/services/runner/internal/storage"
)

func TestCreateRunPersistsAcrossRestart(t *testing.T) {
	path := t.TempDir() + "/runner.sqlite"
	db, err := storage.NewSQLiteStore(path)
	if err != nil {
		t.Fatal(err)
	}
	store := NewStore(db)
	run, err := store.CreateRun(context.Background(), "tenant-a", "", []string{"tool:echo"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.AppendEvent(context.Background(), run.ID, Event{Type: "x", Payload: []byte(`{}`), CreatedAt: time.Now()}); err != nil {
		t.Fatal(err)
	}
	_ = db.Close()

	db2, err := storage.NewSQLiteStore(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db2.Close()
	store2 := NewStore(db2)
	events, err := store2.EventHistory(context.Background(), "tenant-a", run.ID, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) == 0 {
		t.Fatal("expected persisted events")
	}
}
