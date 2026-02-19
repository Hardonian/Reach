package performance

import (
	"context"
	"sync/atomic"
	"testing"
	"time"
)

func TestNewMemoryGuard(t *testing.T) {
	// Test with explicit limit
	g := NewMemoryGuard(512)
	if g == nil {
		t.Fatal("expected non-nil MemoryGuard")
	}
	if g.maxBytes != 512*1024*1024 {
		t.Errorf("expected maxBytes %d, got %d", 512*1024*1024, g.maxBytes)
	}
	if g.warningThreshold != 0.8 {
		t.Errorf("expected warningThreshold 0.8, got %f", g.warningThreshold)
	}
}

func TestNewMemoryGuardAutoDetect(t *testing.T) {
	// Test with auto-detect (0)
	g := NewMemoryGuard(0)
	if g == nil {
		t.Fatal("expected non-nil MemoryGuard")
	}
	if g.maxBytes == 0 {
		t.Error("expected auto-detected maxBytes to be non-zero")
	}
}

func TestMemoryGuardAllocate(t *testing.T) {
	g := NewMemoryGuard(100) // 100MB limit

	// Allocate within limit
	err := g.Allocate(50 * 1024 * 1024) // 50MB
	if err != nil {
		t.Errorf("unexpected error allocating 50MB: %v", err)
	}

	// Check current usage
	usage := g.CurrentUsage()
	if usage != 50*1024*1024 {
		t.Errorf("expected usage %d, got %d", 50*1024*1024, usage)
	}

	// Release
	g.Release(50 * 1024 * 1024)
	usage = g.CurrentUsage()
	if usage != 0 {
		t.Errorf("expected usage 0 after release, got %d", usage)
	}
}

func TestMemoryGuardAllocateExceedsLimit(t *testing.T) {
	g := NewMemoryGuard(10) // 10MB limit

	// Try to allocate more than limit
	err := g.Allocate(20 * 1024 * 1024) // 20MB
	if err == nil {
		t.Error("expected error when exceeding limit")
	}

	// Usage should be rolled back
	usage := g.CurrentUsage()
	if usage != 0 {
		t.Errorf("expected usage 0 after failed allocation, got %d", usage)
	}
}

func TestMemoryGuardReleaseNegative(t *testing.T) {
	g := NewMemoryGuard(100)

	// Release more than allocated
	g.Release(100 * 1024 * 1024)

	// Should not go negative
	usage := g.CurrentUsage()
	if usage != 0 {
		t.Errorf("expected usage 0, got %d", usage)
	}
}

func TestMemoryGuardWarningThreshold(t *testing.T) {
	g := NewMemoryGuard(100) // 100MB limit
	g.warningThreshold = 0.5 // 50% warning threshold

	var warningCalled atomic.Bool
	g.OnMemoryEvent(func(event MemoryEvent) {
		if event.Type == "warning" {
			warningCalled.Store(true)
		}
	})

	// Allocate 60MB (above 50% threshold)
	g.Allocate(60 * 1024 * 1024)

	// Give callback time to fire
	time.Sleep(10 * time.Millisecond)

	if !warningCalled.Load() {
		t.Error("expected warning callback to be called")
	}

	stats := g.Stats()
	if stats.Warnings != 1 {
		t.Errorf("expected 1 warning, got %d", stats.Warnings)
	}
}

func TestMemoryGuardPeakTracking(t *testing.T) {
	g := NewMemoryGuard(100)

	g.Allocate(30 * 1024 * 1024)
	g.Release(30 * 1024 * 1024)
	g.Allocate(20 * 1024 * 1024)
	g.Release(20 * 1024 * 1024)

	stats := g.Stats()
	if stats.PeakUsage < 30*1024*1024 {
		t.Errorf("expected peak >= 30MB, got %d", stats.PeakUsage)
	}
}

func TestMemoryGuardMultipleCallbacks(t *testing.T) {
	g := NewMemoryGuard(100)
	g.warningThreshold = 0.1 // Very low threshold

	var callCount atomic.Int32
	g.OnMemoryEvent(func(event MemoryEvent) {
		callCount.Add(1)
	})
	g.OnMemoryEvent(func(event MemoryEvent) {
		callCount.Add(1)
	})

	g.Allocate(20 * 1024 * 1024)
	time.Sleep(10 * time.Millisecond)

	if callCount.Load() != 2 {
		t.Errorf("expected 2 callback calls, got %d", callCount.Load())
	}
}

func TestMemoryGuardForceGC(t *testing.T) {
	g := NewMemoryGuard(100)

	initialGCRuns := g.Stats().GCRuns
	g.ForceGC()

	stats := g.Stats()
	if stats.GCRuns != initialGCRuns+1 {
		t.Errorf("expected GCRuns to increase by 1, got %d", stats.GCRuns)
	}
}

func TestMemoryGuardSetGCPercent(t *testing.T) {
	g := NewMemoryGuard(100)

	old := g.SetGCPercent(50)
	_ = old // Previous value varies by environment

	// Just ensure it doesn't panic
}

func TestMemoryGuardMonitor(t *testing.T) {
	g := NewMemoryGuard(1000) // High limit to avoid triggering
	ctx, cancel := context.WithCancel(context.Background())

	g.Monitor(ctx, 10*time.Millisecond)

	// Let it run briefly
	time.Sleep(25 * time.Millisecond)

	cancel()
	time.Sleep(10 * time.Millisecond) // Let goroutine exit

	// Just ensure it doesn't panic
}

func TestPool(t *testing.T) {
	g := NewMemoryGuard(100)

	newFunc := func() any {
		return make([]byte, 1024)
	}

	pool := NewPool(g, 1024, newFunc)

	// Get from pool
	item1 := pool.Get()
	if item1 == nil {
		t.Error("expected non-nil item from pool")
	}

	// Put back
	pool.Put(item1)

	// Get again (should reuse)
	item2 := pool.Get()
	if item2 == nil {
		t.Error("expected non-nil item from pool")
	}
}

func TestBufferPool(t *testing.T) {
	g := NewMemoryGuard(100)
	bp := NewBufferPool(g)

	// Test getting a buffer
	buf := bp.Get(1000)
	if len(buf) != 1000 {
		t.Errorf("expected buffer length 1000, got %d", len(buf))
	}
	if cap(buf) < 1000 {
		t.Errorf("expected buffer capacity >= 1000, got %d", cap(buf))
	}

	// Write to buffer
	for i := range buf {
		buf[i] = byte(i % 256)
	}

	// Return to pool
	bp.Put(buf)

	// Get again - should get a buffer of at least the same size
	buf2 := bp.Get(1000)
	if len(buf2) != 1000 {
		t.Errorf("expected buffer length 1000, got %d", len(buf2))
	}
}

func TestBufferPoolNil(t *testing.T) {
	g := NewMemoryGuard(100)
	bp := NewBufferPool(g)

	// Put nil buffer - should not panic
	bp.Put(nil)
}

func TestBufferPoolPowerOfTwo(t *testing.T) {
	g := NewMemoryGuard(100)
	bp := NewBufferPool(g)

	// Request 100 bytes - should get 128 (next power of 2)
	buf := bp.Get(100)
	if cap(buf) < 100 {
		t.Errorf("expected capacity >= 100, got %d", cap(buf))
	}

	bp.Put(buf)
}

func TestNewOptimizer(t *testing.T) {
	cfg := DefaultOptimizerConfig()
	opt := NewOptimizer(cfg)

	if opt == nil {
		t.Fatal("expected non-nil optimizer")
	}
	if !opt.config.LazyRegistryLoading {
		t.Error("expected LazyRegistryLoading to be true")
	}
}

func TestOptimizerBufferOperations(t *testing.T) {
	cfg := DefaultOptimizerConfig()
	opt := NewOptimizer(cfg)

	// Test hash buffer
	buf := opt.GetHashBuffer(100)
	if len(buf) != 100 {
		t.Errorf("expected buffer length 100, got %d", len(buf))
	}
	opt.PutHashBuffer(buf)

	// Test string buffer
	strBuf := opt.GetStringBuffer()
	if strBuf == nil {
		t.Error("expected non-nil string buffer")
	}
	opt.PutStringBuffer(strBuf)
}

func TestOptimizerStringBufferLarge(t *testing.T) {
	cfg := DefaultOptimizerConfig()
	opt := NewOptimizer(cfg)

	// Large buffer should not be returned to pool
	largeBuf := make([]byte, 5000)
	opt.PutStringBuffer(largeBuf)
	// Should not panic
}

func TestOptimizerLazyLoadRegistry(t *testing.T) {
	cfg := DefaultOptimizerConfig()
	cfg.LazyRegistryLoading = true
	opt := NewOptimizer(cfg)

	loadCount := 0
	loader := func() (map[string]any, error) {
		loadCount++
		return map[string]any{"key": "value"}, nil
	}

	// First call should load
	data1, err := opt.LazyLoadRegistry(loader)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if loadCount != 1 {
		t.Errorf("expected 1 load, got %d", loadCount)
	}

	// Second call should not reload
	data2, err := opt.LazyLoadRegistry(loader)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if loadCount != 1 {
		t.Errorf("expected 1 load after second call, got %d", loadCount)
	}
	// Verify data is consistent
	if data1["key"] != data2["key"] {
		t.Error("expected same data values")
	}
}

func TestOptimizerLazyLoadDisabled(t *testing.T) {
	cfg := DefaultOptimizerConfig()
	cfg.LazyRegistryLoading = false
	opt := NewOptimizer(cfg)

	loadCount := 0
	loader := func() (map[string]any, error) {
		loadCount++
		return map[string]any{"key": "value"}, nil
	}

	// Should load immediately (not lazily)
	_, err := opt.LazyLoadRegistry(loader)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if loadCount != 1 {
		t.Errorf("expected 1 load, got %d", loadCount)
	}
}

func TestOptimizerShallowCopyMap(t *testing.T) {
	cfg := DefaultOptimizerConfig()
	cfg.ReduceDeepClones = true
	opt := NewOptimizer(cfg)

	src := map[string]any{
		"key1": "value1",
		"key2": 42,
	}

	dst := opt.ShallowCopyMap(src)

	if len(dst) != len(src) {
		t.Errorf("expected dst length %d, got %d", len(src), len(dst))
	}
	if dst["key1"] != "value1" {
		t.Errorf("expected key1='value1', got %v", dst["key1"])
	}

	// Shallow copy - modifying dst should not affect src for primitives
	dst["key1"] = "modified"
	if src["key1"] != "value1" {
		t.Error("shallow copy modified source")
	}
}

func TestOptimizerDeepCopyMap(t *testing.T) {
	cfg := DefaultOptimizerConfig()
	cfg.ReduceDeepClones = false
	opt := NewOptimizer(cfg)

	src := map[string]any{
		"nested": map[string]any{
			"key": "value",
		},
	}

	dst := opt.ShallowCopyMap(src)

	// Verify deep copy by modifying dst nested map and checking src is unchanged
	nestedDst := dst["nested"].(map[string]any)
	nestedDst["key"] = "modified"

	nestedSrc := src["nested"].(map[string]any)
	if nestedSrc["key"] != "value" {
		t.Error("deep copy should not modify source when destination is changed")
	}
}

func TestDefaultOptimizerConfig(t *testing.T) {
	cfg := DefaultOptimizerConfig()

	if !cfg.LazyRegistryLoading {
		t.Error("expected LazyRegistryLoading to be true")
	}
	if cfg.StreamingReplay {
		t.Error("expected StreamingReplay to be false")
	}
	if !cfg.BufferReuse {
		t.Error("expected BufferReuse to be true")
	}
	if !cfg.ReduceDeepClones {
		t.Error("expected ReduceDeepClones to be true")
	}
	if !cfg.GCTuning {
		t.Error("expected GCTuning to be true")
	}
}

func TestEdgeModeOptimizerConfig(t *testing.T) {
	cfg := EdgeModeOptimizerConfig()

	if !cfg.LazyRegistryLoading {
		t.Error("expected LazyRegistryLoading to be true")
	}
	if !cfg.StreamingReplay {
		t.Error("expected StreamingReplay to be true in edge mode")
	}
	if !cfg.BufferReuse {
		t.Error("expected BufferReuse to be true")
	}
}

func TestEventStreamer(t *testing.T) {
	streamer := NewEventStreamer(10)
	if streamer == nil {
		t.Fatal("expected non-nil streamer")
	}

	event := map[string]string{"type": "test"}

	// Write should succeed
	err := streamer.Write(event)
	if err != nil {
		t.Errorf("unexpected error writing: %v", err)
	}

	// Close
	streamer.Close()

	// Write after close should fail
	err = streamer.Write(event)
	if err != context.Canceled {
		t.Errorf("expected context.Canceled error, got %v", err)
	}
}

func TestEventStreamerBufferFull(t *testing.T) {
	streamer := NewEventStreamer(1)

	// Fill buffer
	streamer.Write("event1")

	// Second write should block or fail
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	done := make(chan error)
	go func() {
		done <- streamer.Write("event2")
	}()

	select {
	case err := <-done:
		if err != context.DeadlineExceeded {
			t.Logf("Write returned: %v (may succeed if consumer available)", err)
		}
	case <-ctx.Done():
		t.Log("Write blocked as expected with full buffer")
	}

	streamer.Close()
}

func TestAdaptiveConfig(t *testing.T) {
	ac := NewAdaptiveConfig()
	if ac == nil {
		t.Fatal("expected non-nil AdaptiveConfig")
	}

	cfg := ac.GetConfig()
	// Should return some config (specific values depend on runtime environment)
	_ = cfg
}

func TestPerformanceMetrics(t *testing.T) {
	pm := &PerformanceMetrics{}

	// Record some metrics
	pm.Record("event_process", 100*time.Millisecond)
	pm.Record("hash_compute", 50*time.Millisecond)

	snapshot := pm.Snapshot()

	if snapshot["eventProcessingTime"] != 100*time.Millisecond {
		t.Errorf("expected eventProcessingTime 100ms, got %v", snapshot["eventProcessingTime"])
	}
	if snapshot["hashComputeTime"] != 50*time.Millisecond {
		t.Errorf("expected hashComputeTime 50ms, got %v", snapshot["hashComputeTime"])
	}
}

func TestTimer(t *testing.T) {
	timer := StartTimer("test_op")
	time.Sleep(10 * time.Millisecond)
	duration := timer.Stop()

	if duration < 10*time.Millisecond {
		t.Errorf("expected duration >= 10ms, got %v", duration)
	}
}

func TestSetMemoryLimit(t *testing.T) {
	// Save original
	original := GlobalMemoryGuard

	SetMemoryLimit(256)
	if GlobalMemoryGuard.maxBytes != 256*1024*1024 {
		t.Errorf("expected maxBytes %d, got %d", 256*1024*1024, GlobalMemoryGuard.maxBytes)
	}

	// Restore
	GlobalMemoryGuard = original
}

func TestCheckMemory(t *testing.T) {
	info := CheckMemory()

	requiredKeys := []string{"alloc", "total_alloc", "sys", "num_gc", "heap_alloc", "heap_sys"}
	for _, key := range requiredKeys {
		if _, ok := info[key]; !ok {
			t.Errorf("expected key '%s' in memory info", key)
		}
	}
}

func BenchmarkMemoryGuardAllocate(b *testing.B) {
	g := NewMemoryGuard(1000)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		g.Allocate(1024)
	}
}

func BenchmarkBufferPoolGet(b *testing.B) {
	g := NewMemoryGuard(100)
	bp := NewBufferPool(g)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		buf := bp.Get(1024)
		bp.Put(buf)
	}
}
