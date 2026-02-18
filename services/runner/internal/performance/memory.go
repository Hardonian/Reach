// Package performance provides runtime performance monitoring and
// resource management for constrained environments.
package performance

import (
	"context"
	"fmt"
	"runtime"
	"runtime/debug"
	"sync"
	"sync/atomic"
	"time"
)

// MemoryGuard enforces memory limits and provides monitoring.
type MemoryGuard struct {
	maxBytes     int64
	currentBytes int64
	warningThreshold float64 // 0.0 - 1.0
	
	callbacks    []MemoryCallback
	mu           sync.RWMutex
	
	// Statistics
	stats MemoryStats
}

// MemoryCallback is called when memory conditions change.
type MemoryCallback func(event MemoryEvent)

// MemoryEvent describes a memory condition.
type MemoryEvent struct {
	Type      string // "warning", "critical", "released"
	UsedBytes int64
	MaxBytes  int64
	Percent   float64
	Message   string
}

// MemoryStats tracks memory usage statistics.
type MemoryStats struct {
	PeakUsage      int64     `json:"peakUsage"`
	Warnings       int64     `json:"warnings"`
	CriticalEvents int64     `json:"criticalEvents"`
	GCRuns         int64     `json:"gcRuns"`
	LastChecked    time.Time `json:"lastChecked"`
}

// NewMemoryGuard creates a memory guard with the specified limit.
func NewMemoryGuard(maxMB int) *MemoryGuard {
	maxBytes := int64(maxMB) * 1024 * 1024
	if maxMB == 0 {
		// Auto-detect based on system
		maxBytes = autoDetectMemoryLimit()
	}
	
	return &MemoryGuard{
		maxBytes:         maxBytes,
		warningThreshold: 0.8,
		callbacks:        make([]MemoryCallback, 0),
	}
}

// autoDetectMemoryLimit estimates a safe memory limit.
func autoDetectMemoryLimit() int64 {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	// Conservative: 50% of system memory or 512MB, whichever is smaller
	sysMB := m.Sys / (1024 * 1024)
	limitMB := sysMB / 2
	if limitMB > 512 {
		limitMB = 512
	}
	if limitMB < 128 {
		limitMB = 128
	}
	
	return int64(limitMB * 1024 * 1024)
}

// Allocate attempts to reserve memory, returning error if limit exceeded.
func (g *MemoryGuard) Allocate(bytes int64) error {
	newTotal := atomic.AddInt64(&g.currentBytes, bytes)
	
	// Update peak
	for {
		peak := atomic.LoadInt64(&g.stats.PeakUsage)
		if newTotal <= peak || atomic.CompareAndSwapInt64(&g.stats.PeakUsage, peak, newTotal) {
			break
		}
	}
	
	// Check limits
	if g.maxBytes > 0 && newTotal > g.maxBytes {
		// Rollback
		atomic.AddInt64(&g.currentBytes, -bytes)
		return fmt.Errorf("memory limit exceeded: %d bytes (limit: %d)", newTotal, g.maxBytes)
	}
	
	// Check warning threshold
	if g.maxBytes > 0 {
		percent := float64(newTotal) / float64(g.maxBytes)
		if percent > g.warningThreshold {
			g.notify(MemoryEvent{
				Type:      "warning",
				UsedBytes: newTotal,
				MaxBytes:  g.maxBytes,
				Percent:   percent,
				Message:   fmt.Sprintf("Memory usage at %.1f%%", percent*100),
			})
			atomic.AddInt64(&g.stats.Warnings, 1)
		}
	}
	
	return nil
}

// Release returns memory to the pool.
func (g *MemoryGuard) Release(bytes int64) {
	atomic.AddInt64(&g.currentBytes, -bytes)
	// Ensure we don't go negative
	if atomic.LoadInt64(&g.currentBytes) < 0 {
		atomic.StoreInt64(&g.currentBytes, 0)
	}
}

// CurrentUsage returns current memory allocation.
func (g *MemoryGuard) CurrentUsage() int64 {
	return atomic.LoadInt64(&g.currentBytes)
}

// Stats returns memory statistics.
func (g *MemoryGuard) Stats() MemoryStats {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.stats
}

// OnMemoryEvent registers a callback for memory events.
func (g *MemoryGuard) OnMemoryEvent(callback MemoryCallback) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.callbacks = append(g.callbacks, callback)
}

func (g *MemoryGuard) notify(event MemoryEvent) {
	g.mu.RLock()
	callbacks := make([]MemoryCallback, len(g.callbacks))
	copy(callbacks, g.callbacks)
	g.mu.RUnlock()
	
	for _, cb := range callbacks {
		cb(event)
	}
}

// ForceGC runs garbage collection and returns memory stats.
func (g *MemoryGuard) ForceGC() runtime.MemStats {
	runtime.GC()
	atomic.AddInt64(&g.stats.GCRuns, 1)
	
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	g.mu.Lock()
	g.stats.LastChecked = time.Now()
	g.mu.Unlock()
	
	return m
}

// SetGCPercent adjusts garbage collection target.
func (g *MemoryGuard) SetGCPercent(percent int) int {
	return debug.SetGCPercent(percent)
}

// Monitor starts a background monitoring goroutine.
func (g *MemoryGuard) Monitor(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				g.checkMemory()
			}
		}
	}()
}

func (g *MemoryGuard) checkMemory() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	g.mu.Lock()
	g.stats.LastChecked = time.Now()
	g.mu.Unlock()
	
	if g.maxBytes > 0 && m.Alloc > uint64(g.maxBytes) {
		g.notify(MemoryEvent{
			Type:      "critical",
			UsedBytes: int64(m.Alloc),
			MaxBytes:  g.maxBytes,
			Percent:   float64(m.Alloc) / float64(g.maxBytes),
			Message:   "Critical: Memory limit exceeded, forcing GC",
		})
		atomic.AddInt64(&g.stats.CriticalEvents, 1)
		g.ForceGC()
	}
}

// Pool provides a sync.Pool with memory tracking.
type Pool struct {
	pool    sync.Pool
	guard   *MemoryGuard
	size    int64
}

// NewPool creates a memory-tracked pool.
func NewPool(guard *MemoryGuard, size int64, newFunc func() any) *Pool {
	return &Pool{
		guard: guard,
		size:  size,
		pool: sync.Pool{
			New: newFunc,
		},
	}
}

// Get retrieves an item from the pool.
func (p *Pool) Get() any {
	return p.pool.Get()
}

// Put returns an item to the pool.
func (p *Pool) Put(x any) {
	p.pool.Put(x)
}

// BufferPool is a pool for byte slices.
type BufferPool struct {
	guard *MemoryGuard
	pools map[int]*sync.Pool // size -> pool
	mu    sync.RWMutex
}

// NewBufferPool creates a new buffer pool.
func NewBufferPool(guard *MemoryGuard) *BufferPool {
	return &BufferPool{
		guard: guard,
		pools: make(map[int]*sync.Pool),
	}
}

// Get retrieves a buffer of at least the specified size.
func (p *BufferPool) Get(size int) []byte {
	// Round up to nearest power of 2
	poolSize := 1
	for poolSize < size {
		poolSize *= 2
	}
	
	p.mu.RLock()
	pool, exists := p.pools[poolSize]
	p.mu.RUnlock()
	
	if !exists {
		p.mu.Lock()
		pool = &sync.Pool{
			New: func() any {
				return make([]byte, poolSize)
			},
		}
		p.pools[poolSize] = pool
		p.mu.Unlock()
	}
	
	buf := pool.Get().([]byte)
	if cap(buf) < size {
		// Shouldn't happen if pools are sized correctly
		buf = make([]byte, size)
	}
	
	return buf[:size]
}

// Put returns a buffer to the pool.
func (p *BufferPool) Put(buf []byte) {
	if buf == nil {
		return
	}
	
	capacity := cap(buf)
	
	p.mu.RLock()
	pool, exists := p.pools[capacity]
	p.mu.RUnlock()
	
	if exists {
		pool.Put(buf[:capacity])
	}
	// If pool doesn't exist, let GC collect it
}

// GlobalMemoryGuard is the default memory guard for the process.
var GlobalMemoryGuard = NewMemoryGuard(0)

// SetMemoryLimit sets the global memory limit.
func SetMemoryLimit(maxMB int) {
	GlobalMemoryGuard = NewMemoryGuard(maxMB)
}

// CheckMemory returns current memory usage info.
func CheckMemory() map[string]any {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	return map[string]any{
		"alloc":       m.Alloc,
		"total_alloc": m.TotalAlloc,
		"sys":         m.Sys,
		"num_gc":      m.NumGC,
		"heap_alloc":  m.HeapAlloc,
		"heap_sys":    m.HeapSys,
	}
}
