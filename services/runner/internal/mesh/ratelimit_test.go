package mesh

import (
	"testing"
	"time"
)

func TestMeshRateLimiter_PerNodeLimit(t *testing.T) {
	config := MeshRateLimitConfig{
		RequestsPerMinutePerNode: 5,
		GlobalRequestsPerMinute:  100,
		MaxConcurrentTasks:       50,
		LoopCascadeWindow:        30 * time.Second,
		LoopCascadeThreshold:     100, // high so cascade doesn't trigger first
		CooldownDuration:         60 * time.Second,
	}

	rl := NewMeshRateLimiter(config)

	for i := 0; i < 5; i++ {
		if err := rl.Allow("node-a"); err != nil {
			t.Fatalf("request %d should be allowed: %v", i, err)
		}
	}

	// 6th request should be denied
	if err := rl.Allow("node-a"); err == nil {
		t.Fatal("6th request should be rate limited")
	}

	// Different node should still be allowed
	if err := rl.Allow("node-b"); err != nil {
		t.Fatalf("node-b should be allowed: %v", err)
	}
}

func TestMeshRateLimiter_GlobalLimit(t *testing.T) {
	config := MeshRateLimitConfig{
		RequestsPerMinutePerNode: 100,
		GlobalRequestsPerMinute:  3,
		MaxConcurrentTasks:       50,
		LoopCascadeWindow:        30 * time.Second,
		LoopCascadeThreshold:     100,
		CooldownDuration:         60 * time.Second,
	}

	rl := NewMeshRateLimiter(config)

	// Use different nodes to avoid per-node limit
	for i := 0; i < 3; i++ {
		nodeID := "node-" + string(rune('a'+i))
		if err := rl.Allow(nodeID); err != nil {
			t.Fatalf("request %d should be allowed: %v", i, err)
		}
	}

	// 4th request from any node should be denied
	if err := rl.Allow("node-d"); err == nil {
		t.Fatal("4th request should be globally rate limited")
	}
}

func TestMeshRateLimiter_ConcurrentTasks(t *testing.T) {
	config := DefaultMeshRateLimitConfig()
	config.MaxConcurrentTasks = 2

	rl := NewMeshRateLimiter(config)

	if err := rl.AcquireTask(); err != nil {
		t.Fatalf("1st task should be allowed: %v", err)
	}
	if err := rl.AcquireTask(); err != nil {
		t.Fatalf("2nd task should be allowed: %v", err)
	}
	if err := rl.AcquireTask(); err == nil {
		t.Fatal("3rd task should be rejected")
	}

	rl.ReleaseTask()

	if err := rl.AcquireTask(); err != nil {
		t.Fatalf("after release, task should be allowed: %v", err)
	}

	if rl.ActiveTasks() != 2 {
		t.Fatalf("expected 2 active tasks, got %d", rl.ActiveTasks())
	}
}

func TestMeshRateLimiter_CascadeDetection(t *testing.T) {
	config := MeshRateLimitConfig{
		RequestsPerMinutePerNode: 100,
		GlobalRequestsPerMinute:  100,
		MaxConcurrentTasks:       50,
		LoopCascadeWindow:        1 * time.Second,
		LoopCascadeThreshold:     3,
		CooldownDuration:         100 * time.Millisecond,
	}

	rl := NewMeshRateLimiter(config)

	// Fire 3 requests rapidly (at threshold)
	for i := 0; i < 3; i++ {
		if err := rl.Allow("cascade-node"); err != nil {
			t.Fatalf("request %d should be allowed: %v", i, err)
		}
	}

	// 4th request should trigger cascade protection
	if err := rl.Allow("cascade-node"); err == nil {
		t.Fatal("should trigger cascade protection")
	}

	// Node should be cooling down
	if !rl.IsNodeCoolingDown("cascade-node") {
		t.Fatal("node should be in cooldown")
	}

	// Wait for cooldown to expire
	time.Sleep(150 * time.Millisecond)

	if rl.IsNodeCoolingDown("cascade-node") {
		t.Fatal("cooldown should have expired")
	}
}

func TestMeshRateLimiter_Stats(t *testing.T) {
	rl := NewMeshRateLimiter(DefaultMeshRateLimitConfig())

	rl.Allow("node-a")
	rl.Allow("node-b")
	rl.AcquireTask()

	stats := rl.Stats()
	if stats.TrackedNodes != 2 {
		t.Fatalf("expected 2 tracked nodes, got %d", stats.TrackedNodes)
	}
	if stats.ActiveTasks != 1 {
		t.Fatalf("expected 1 active task, got %d", stats.ActiveTasks)
	}
	if stats.GlobalRequests != 2 {
		t.Fatalf("expected 2 global requests, got %d", stats.GlobalRequests)
	}
}

func TestPruneOld(t *testing.T) {
	now := time.Now().UTC()
	timestamps := []time.Time{
		now.Add(-5 * time.Minute),
		now.Add(-3 * time.Minute),
		now.Add(-30 * time.Second),
		now.Add(-10 * time.Second),
	}

	result := pruneOld(timestamps, now, time.Minute)
	if len(result) != 2 {
		t.Fatalf("expected 2 recent timestamps, got %d", len(result))
	}
}
