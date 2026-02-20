package mesh

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestGenerateCorrelationID(t *testing.T) {
	id1 := GenerateCorrelationID()
	id2 := GenerateCorrelationID()

	if id1 == id2 {
		t.Fatal("correlation IDs should be unique")
	}

	if !id1.IsValid() {
		t.Fatalf("correlation ID should be valid: %s", id1)
	}

	if id1[:4] != "cid-" {
		t.Fatalf("expected cid- prefix, got: %s", id1)
	}
}

func TestCorrelationID_IsValid(t *testing.T) {
	tests := []struct {
		id    CorrelationID
		valid bool
	}{
		{"cid-abc123", true},
		{"cid-", false}, // too short
		{"xxx-abc", false},
		{"", false},
	}

	for _, tc := range tests {
		if tc.id.IsValid() != tc.valid {
			t.Errorf("IsValid(%q) = %v, want %v", tc.id, tc.id.IsValid(), tc.valid)
		}
	}
}

func TestContextWithCorrelation(t *testing.T) {
	ctx := context.Background()
	cid := GenerateCorrelationID()

	ctx = ContextWithCorrelation(ctx, cid)
	got := CorrelationFromContext(ctx)

	if got != cid {
		t.Fatalf("expected %s, got %s", cid, got)
	}
}

func TestCorrelationFromContext_Empty(t *testing.T) {
	ctx := context.Background()
	got := CorrelationFromContext(ctx)
	if got != "" {
		t.Fatalf("expected empty, got %s", got)
	}
}

func TestMeshLogger_LogAndGetLineage(t *testing.T) {
	logger := NewMeshLogger("node-a")
	cid := GenerateCorrelationID()

	logger.Log(MeshLogEntry{
		CorrelationID: cid,
		Level:         "info",
		Component:     "mesh.router",
		Event:         "route.initiated",
		Message:       "routing task to node-b",
		TaskID:        "task-1",
	})

	logger.Log(MeshLogEntry{
		CorrelationID: cid,
		Level:         "info",
		Component:     "mesh.router",
		Event:         "route.sent",
		Message:       "task sent to node-b",
		TaskID:        "task-1",
	})

	lineage := logger.GetLineage(cid)
	if len(lineage) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(lineage))
	}

	if lineage[0].Event != "route.initiated" {
		t.Fatalf("expected route.initiated, got %s", lineage[0].Event)
	}
	if lineage[0].NodeID != "node-a" {
		t.Fatalf("expected node-a, got %s", lineage[0].NodeID)
	}
}

func TestMeshLogger_LogEventConvenience(t *testing.T) {
	logger := NewMeshLogger("node-b")
	cid := GenerateCorrelationID()

	logger.LogEvent(cid, "info", "mesh.handshake", "handshake.started", "beginning handshake with node-a")

	lineage := logger.GetLineage(cid)
	if len(lineage) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(lineage))
	}
	if lineage[0].Component != "mesh.handshake" {
		t.Fatalf("expected mesh.handshake, got %s", lineage[0].Component)
	}
}

func TestMeshLogger_LogTaskEvent(t *testing.T) {
	logger := NewMeshLogger("node-a")
	cid := GenerateCorrelationID()

	logger.LogTaskEvent(cid, "task-1", "exec.started", "executing task", nil)
	logger.LogTaskEvent(cid, "task-1", "exec.failed", "task failed", errors.New("something broke"))

	lineage := logger.GetLineage(cid)
	if len(lineage) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(lineage))
	}
	if lineage[1].Error != "something broke" {
		t.Fatalf("expected error message, got %s", lineage[1].Error)
	}
	if lineage[1].Level != "error" {
		t.Fatalf("expected error level, got %s", lineage[1].Level)
	}
}

func TestMeshLogger_GetLineageForTask(t *testing.T) {
	logger := NewMeshLogger("node-a")
	cid1 := GenerateCorrelationID()
	cid2 := GenerateCorrelationID()

	logger.Log(MeshLogEntry{CorrelationID: cid1, Event: "a", TaskID: "task-1"})
	logger.Log(MeshLogEntry{CorrelationID: cid1, Event: "b", TaskID: "task-2"})
	logger.Log(MeshLogEntry{CorrelationID: cid2, Event: "c", TaskID: "task-1"})

	entries := logger.GetLineageForTask("task-1")
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries for task-1, got %d", len(entries))
	}
}

func TestMeshLogger_MaxEntries(t *testing.T) {
	logger := NewMeshLogger("node-a").WithMaxEntries(3)
	cid := GenerateCorrelationID()

	for i := 0; i < 10; i++ {
		logger.Log(MeshLogEntry{CorrelationID: cid, Event: "test"})
	}

	lineage := logger.GetLineage(cid)
	if len(lineage) != 3 {
		t.Fatalf("expected 3 entries (max), got %d", len(lineage))
	}
}

func TestMeshLogger_Prune(t *testing.T) {
	logger := NewMeshLogger("node-a")
	cid1 := GenerateCorrelationID()
	cid2 := GenerateCorrelationID()

	// Old entry
	logger.Log(MeshLogEntry{
		CorrelationID: cid1,
		Timestamp:     time.Now().UTC().Add(-10 * time.Minute),
		Event:         "old",
	})

	// Recent entry
	logger.Log(MeshLogEntry{
		CorrelationID: cid2,
		Event:         "recent",
	})

	pruned := logger.Prune(5 * time.Minute)
	if pruned != 1 {
		t.Fatalf("expected 1 pruned, got %d", pruned)
	}

	if logger.ActiveCorrelations() != 1 {
		t.Fatalf("expected 1 active correlation, got %d", logger.ActiveCorrelations())
	}
}

func TestMeshLogger_Sink(t *testing.T) {
	var received []MeshLogEntry
	logger := NewMeshLogger("node-a").WithSink(func(entry MeshLogEntry) {
		received = append(received, entry)
	})

	cid := GenerateCorrelationID()
	logger.LogEvent(cid, "info", "test", "test.event", "hello")

	if len(received) != 1 {
		t.Fatalf("expected 1 sink entry, got %d", len(received))
	}
}

func TestMeshLogger_Stats(t *testing.T) {
	logger := NewMeshLogger("node-a")
	cid1 := GenerateCorrelationID()
	cid2 := GenerateCorrelationID()

	logger.LogEvent(cid1, "info", "test", "a", "msg")
	logger.LogEvent(cid1, "info", "test", "b", "msg")
	logger.LogEvent(cid2, "info", "test", "c", "msg")

	stats := logger.Stats()
	if stats.ActiveChains != 2 {
		t.Fatalf("expected 2 chains, got %d", stats.ActiveChains)
	}
	if stats.TotalEntries != 3 {
		t.Fatalf("expected 3 total entries, got %d", stats.TotalEntries)
	}
}
