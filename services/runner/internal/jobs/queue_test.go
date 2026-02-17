package jobs

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"reach/services/runner/internal/storage"
)

func TestQueueIdempotencyAndLease(t *testing.T) {
	db, err := storage.NewSQLiteStore(filepath.Join(t.TempDir(), "runner.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	q := NewDurableQueue(db)
	job := QueueJob{ID: "job-1", TenantID: "t1", SessionID: "s1", RunID: "r1", Type: JobToolCall, PayloadJSON: `{}`, IdempotencyKey: "k1", Priority: 10}
	if err := q.Enqueue(context.Background(), job); err != nil {
		t.Fatal(err)
	}
	if err := q.Enqueue(context.Background(), job); err != ErrDuplicateJob {
		t.Fatalf("expected duplicate, got %v", err)
	}
	token, leased, err := q.Lease(context.Background(), 10, 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if len(leased) != 1 {
		t.Fatalf("expected 1 leased, got %d", len(leased))
	}
	if err := q.Complete(context.Background(), leased[0].ID, token, `{"ok":true}`); err != nil {
		t.Fatal(err)
	}
}
