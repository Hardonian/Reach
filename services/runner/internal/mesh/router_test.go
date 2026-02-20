package mesh

import (
	"encoding/json"
	"testing"
	"time"
)

func TestValidateRoute_RequiresExplicitTarget(t *testing.T) {
	router := NewTaskRouter("node-a", nil, nil)

	route := TaskRoute{
		TaskID:       "task-1",
		OriginNodeID: "node-a",
		TargetNodeID: "", // empty = no explicit target
		TaskType:     "exec",
		CreatedAt:    time.Now().UTC(),
	}

	err := router.validateRoute(route)
	if err == nil {
		t.Fatal("expected error for missing target_node_id")
	}
	if err.Error() != "target_node_id is required: explicit targeting required" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateRoute_LoopDetection(t *testing.T) {
	router := NewTaskRouter("node-b", nil, nil)

	route := TaskRoute{
		TaskID:       "task-2",
		OriginNodeID: "node-a",
		TargetNodeID: "node-b",
		TaskType:     "exec",
		Hops:         []string{"node-a", "node-b"}, // node-b already visited
		MaxHops:      5,
		CreatedAt:    time.Now().UTC(),
	}

	err := router.validateRoute(route)
	if err == nil {
		t.Fatal("expected loop detection error")
	}
}

func TestValidateRoute_MaxHops(t *testing.T) {
	router := NewTaskRouter("node-d", nil, nil)

	route := TaskRoute{
		TaskID:       "task-3",
		OriginNodeID: "node-a",
		TargetNodeID: "node-d",
		TaskType:     "exec",
		Hops:         []string{"node-a", "node-b", "node-c", "node-e", "node-f"},
		MaxHops:      5,
		CreatedAt:    time.Now().UTC(),
	}

	err := router.validateRoute(route)
	if err == nil {
		t.Fatal("expected max hops error")
	}
}

func TestValidateRoute_TTLExpired(t *testing.T) {
	router := NewTaskRouter("node-a", nil, nil)

	route := TaskRoute{
		TaskID:       "task-4",
		OriginNodeID: "node-a",
		TargetNodeID: "node-b",
		TaskType:     "exec",
		TTL:          1 * time.Millisecond,
		CreatedAt:    time.Now().UTC().Add(-1 * time.Second),
	}

	err := router.validateRoute(route)
	if err == nil {
		t.Fatal("expected TTL expired error")
	}
}

func TestValidateRoute_Deduplication(t *testing.T) {
	router := NewTaskRouter("node-a", nil, nil)

	// Pre-mark a task as seen
	router.mu.Lock()
	router.seen["task-5"] = time.Now().UTC()
	router.mu.Unlock()

	route := TaskRoute{
		TaskID:       "task-5",
		OriginNodeID: "node-a",
		TargetNodeID: "node-b",
		TaskType:     "exec",
		CreatedAt:    time.Now().UTC(),
	}

	err := router.validateRoute(route)
	if err == nil {
		t.Fatal("expected deduplication error")
	}
}

func TestValidateRoute_Valid(t *testing.T) {
	router := NewTaskRouter("node-c", nil, nil)

	route := TaskRoute{
		TaskID:       "task-6",
		OriginNodeID: "node-a",
		TargetNodeID: "node-c",
		TaskType:     "exec",
		Hops:         []string{"node-a"},
		MaxHops:      5,
		CreatedAt:    time.Now().UTC(),
		TTL:          5 * time.Minute,
	}

	err := router.validateRoute(route)
	if err != nil {
		t.Fatalf("expected valid route, got: %v", err)
	}
}

func TestExecuteLocal(t *testing.T) {
	router := NewTaskRouter("node-a", nil, nil)

	called := false
	router.RegisterHandler("test_task", func(route TaskRoute) (TaskResult, error) {
		called = true
		return TaskResult{
			Status: "completed",
			Result: json.RawMessage(`{"ok":true}`),
		}, nil
	})

	route := TaskRoute{
		TaskID:       "task-7",
		OriginNodeID: "node-a",
		TargetNodeID: "node-a",
		TaskType:     "test_task",
		CreatedAt:    time.Now().UTC(),
	}

	err := router.executeLocal(route)
	if err != nil {
		t.Fatalf("expected success, got: %v", err)
	}
	if !called {
		t.Fatal("handler was not called")
	}
}

func TestExecuteLocal_NoHandler(t *testing.T) {
	router := NewTaskRouter("node-a", nil, nil)

	route := TaskRoute{
		TaskID:       "task-8",
		OriginNodeID: "node-a",
		TargetNodeID: "node-a",
		TaskType:     "unknown_type",
		CreatedAt:    time.Now().UTC(),
	}

	err := router.executeLocal(route)
	if err == nil {
		t.Fatal("expected error for missing handler")
	}
}

func TestCleanupSeen(t *testing.T) {
	router := NewTaskRouter("node-a", nil, nil)

	router.mu.Lock()
	router.seen["old-task"] = time.Now().UTC().Add(-10 * time.Minute)
	router.seen["new-task"] = time.Now().UTC()
	router.mu.Unlock()

	router.CleanupSeen(5 * time.Minute)

	router.mu.RLock()
	defer router.mu.RUnlock()
	if _, exists := router.seen["old-task"]; exists {
		t.Fatal("old task should have been cleaned up")
	}
	if _, exists := router.seen["new-task"]; !exists {
		t.Fatal("new task should still exist")
	}
}
