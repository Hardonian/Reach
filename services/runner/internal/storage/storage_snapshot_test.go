package storage

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSnapshotAndPrune(t *testing.T) {
	ctx := context.Background()
	tmpDir, err := os.MkdirTemp("", "reach_storage_snapshot_test_*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "reach.db")
	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("failed to create store: %v", err)
	}
	defer store.Close()

	tenantID := "tenant-alpha"
	runID := "run-omega"

	// 1. Create a run
	if err := store.CreateRun(ctx, RunRecord{
		ID:           runID,
		TenantID:     tenantID,
		Status:       "running",
		PackCID:      "some-pack-cid",
		Fingerprint:  "initial-fingerprint",
		Capabilities: []string{},
		CreatedAt:    time.Now().UTC(),
	}); err != nil {
		t.Fatalf("failed to create run: %v", err)
	}

	// 2. Insert 10 events
	for i := 1; i <= 10; i++ {
		_, err := store.AppendEvent(ctx, EventRecord{
			RunID:     runID,
			Type:      "test.event",
			Payload:   []byte(`{"seq": ` + string(rune('0'+i)) + `}`),
			CreatedAt: time.Now().UTC(),
		})
		if err != nil {
			t.Fatalf("failed to append event %d: %v", i, err)
		}
	}

	// 3. Verify 10 events exist
	events, err := store.ListEvents(ctx, tenantID, runID, 0)
	if err != nil {
		t.Fatalf("failed to list events: %v", err)
	}
	if len(events) != 10 {
		t.Fatalf("expected 10 events, got %d", len(events))
	}

	// 4. Save a snapshot up to event ID 5
	upToEventID := events[4].ID // 5th event (0-indexed)
	if _, err := store.SaveSnapshot(ctx, SnapshotRecord{
		RunID:        runID,
		LastEventID:  upToEventID,
		StatePayload: []byte(`{"snapshotted_state": true}`),
		CreatedAt:    time.Now().UTC(),
	}); err != nil {
		t.Fatalf("failed to save snapshot: %v", err)
	}

	// 5. Verify snapshot retrieval
	snap, err := store.GetLatestSnapshot(ctx, runID)
	if err != nil {
		t.Fatalf("failed to get latest snapshot: %v", err)
	}
	if snap.LastEventID != upToEventID {
		t.Fatalf("expected snapshot LastEventID to be %d, got %d", upToEventID, snap.LastEventID)
	}
	if string(snap.StatePayload) != `{"snapshotted_state": true}` {
		t.Fatalf("snapshot payload mismatch, got: %s", string(snap.StatePayload))
	}

	// 6. Prune (tombstone) events up to event ID 5
	pruned, err := store.PruneEvents(ctx, runID, upToEventID)
	if err != nil {
		t.Fatalf("failed to prune events: %v", err)
	}
	if pruned != 5 {
		t.Fatalf("expected 5 events pruned, got %d", pruned)
	}

	// 7. Verify remaining events
	remainingEvents, err := store.ListEvents(ctx, tenantID, runID, 0)
	if err != nil {
		t.Fatalf("failed to list events after pruning: %v", err)
	}
	if len(remainingEvents) != 5 {
		t.Fatalf("expected 5 events remaining, got %d", len(remainingEvents))
	}
	// The first remaining event should be event ID 6 (which has original index 5)
	if remainingEvents[0].ID <= upToEventID {
		t.Fatalf("expected remaining event IDs to be > %d, got first event ID %d", upToEventID, remainingEvents[0].ID)
	}
}
