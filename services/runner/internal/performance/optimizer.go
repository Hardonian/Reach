package performance

import (
	"context"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

// Optimizer provides runtime performance optimizations.
type Optimizer struct {
	config OptimizerConfig
	
	// Lazy loading state
	registryLoaded atomic.Bool
	registryMu     sync.RWMutex
	registryData   map[string]any
	
	// Streaming state
	streamingEnabled bool
	
	// Hot path optimizations
	hashBufferPool *BufferPool
	stringPool     *sync.Pool
}

// OptimizerConfig tunes optimization behavior.
type OptimizerConfig struct {
	LazyRegistryLoading bool `json:"lazyRegistryLoading"`
	StreamingReplay     bool `json:"streamingReplay"`
	BufferReuse         bool `json:"bufferReuse"`
	ReduceDeepClones    bool `json:"reduceDeepClones"`
	GCTuning            bool `json:"gcTuning"`
}

// DefaultOptimizerConfig returns conservative defaults.
func DefaultOptimizerConfig() OptimizerConfig {
	return OptimizerConfig{
		LazyRegistryLoading: true,
		StreamingReplay:     false,
		BufferReuse:         true,
		ReduceDeepClones:    true,
		GCTuning:            true,
	}
}

// EdgeModeOptimizerConfig returns aggressive optimization for constrained environments.
func EdgeModeOptimizerConfig() OptimizerConfig {
	return OptimizerConfig{
		LazyRegistryLoading: true,
		StreamingReplay:     true,
		BufferReuse:         true,
		ReduceDeepClones:    true,
		GCTuning:            true,
	}
}

// NewOptimizer creates a performance optimizer.
func NewOptimizer(config OptimizerConfig) *Optimizer {
	opt := &Optimizer{
		config:           config,
		streamingEnabled: config.StreamingReplay,
		registryData:     make(map[string]any),
		stringPool: &sync.Pool{
			New: func() any {
				return make([]byte, 0, 1024)
			},
		},
	}
	
	if config.BufferReuse {
		opt.hashBufferPool = NewBufferPool(GlobalMemoryGuard)
	}
	
	if config.GCTuning {
		opt.tuneGC()
	}
	
	return opt
}

// tuneGC adjusts garbage collection for the workload.
func (o *Optimizer) tuneGC() {
	// More aggressive GC to reduce memory spikes
	// This trades some CPU for lower memory usage
	old := GlobalMemoryGuard.SetGCPercent(50)
	_ = old
}

// GetHashBuffer retrieves a buffer for hashing.
func (o *Optimizer) GetHashBuffer(size int) []byte {
	if o.hashBufferPool != nil {
		return o.hashBufferPool.Get(size)
	}
	return make([]byte, size)
}

// PutHashBuffer returns a hash buffer to the pool.
func (o *Optimizer) PutHashBuffer(buf []byte) {
	if o.hashBufferPool != nil {
		o.hashBufferPool.Put(buf)
	}
}

// GetStringBuffer retrieves a string builder buffer.
func (o *Optimizer) GetStringBuffer() []byte {
	if o.stringPool != nil {
		return o.stringPool.Get().([]byte)
	}
	return make([]byte, 0, 1024)
}

// PutStringBuffer returns a string buffer.
func (o *Optimizer) PutStringBuffer(buf []byte) {
	if o.stringPool != nil && cap(buf) <= 4096 {
		o.stringPool.Put(buf[:0])
	}
}

// LazyLoadRegistry loads registry data on first access.
func (o *Optimizer) LazyLoadRegistry(loader func() (map[string]any, error)) (map[string]any, error) {
	if !o.config.LazyRegistryLoading {
		return loader()
	}
	
	// Fast path: already loaded
	if o.registryLoaded.Load() {
		o.registryMu.RLock()
		defer o.registryMu.RUnlock()
		return o.registryData, nil
	}
	
	// Slow path: load
	o.registryMu.Lock()
	defer o.registryMu.Unlock()
	
	// Double-check
	if o.registryLoaded.Load() {
		return o.registryData, nil
	}
	
	data, err := loader()
	if err != nil {
		return nil, err
	}
	
	o.registryData = data
	o.registryLoaded.Store(true)
	return data, nil
}

// ShallowCopyMap creates a shallow copy when deep clone isn't needed.
func (o *Optimizer) ShallowCopyMap(src map[string]any) map[string]any {
	if !o.config.ReduceDeepClones {
		// Fall back to deep copy behavior
		return deepCopyMap(src)
	}
	
	// Shallow copy for hot paths
	dst := make(map[string]any, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}

func deepCopyMap(src map[string]any) map[string]any {
	dst := make(map[string]any, len(src))
	for k, v := range src {
		switch val := v.(type) {
		case map[string]any:
			dst[k] = deepCopyMap(val)
		case []any:
			dst[k] = deepCopySlice(val)
		default:
			dst[k] = v
		}
	}
	return dst
}

func deepCopySlice(src []any) []any {
	dst := make([]any, len(src))
	for i, v := range src {
		switch val := v.(type) {
		case map[string]any:
			dst[i] = deepCopyMap(val)
		case []any:
			dst[i] = deepCopySlice(val)
		default:
			dst[i] = v
		}
	}
	return dst
}

// StreamingReplayEnabled returns true if streaming replay is enabled.
func (o *Optimizer) StreamingReplayEnabled() bool {
	return o.streamingEnabled
}

// EventStreamer provides memory-efficient event streaming.
type EventStreamer struct {
	reader chan any
	writer chan any
	mu     sync.Mutex
	closed bool
}

// NewEventStreamer creates a streaming event channel.
func NewEventStreamer(bufferSize int) *EventStreamer {
	return &EventStreamer{
		reader: make(chan any, bufferSize),
		writer: make(chan any, bufferSize),
	}
}

// Write sends an event to the stream.
func (s *EventStreamer) Write(event any) error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return context.Canceled
	}
	s.mu.Unlock()
	
	select {
	case s.writer <- event:
		return nil
	default:
		return context.DeadlineExceeded
	}
}

// Read receives an event from the stream.
func (s *EventStreamer) Read(ctx context.Context) (any, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case event := <-s.reader:
		return event, nil
	}
}

// Close shuts down the stream.
func (s *EventStreamer) Close() {
	s.mu.Lock()
	if !s.closed {
		s.closed = true
		close(s.writer)
	}
	s.mu.Unlock()
}

// AdaptiveConfig adjusts configuration based on runtime conditions.
type AdaptiveConfig struct {
	mu            sync.RWMutex
	config        OptimizerConfig
	deviceClass   string
	memoryProfile string
}

// NewAdaptiveConfig creates an adaptive configuration.
func NewAdaptiveConfig() *AdaptiveConfig {
	ac := &AdaptiveConfig{
		config:        DefaultOptimizerConfig(),
		deviceClass:   detectDeviceClass(),
		memoryProfile: detectMemoryProfile(),
	}
	ac.adapt()
	return ac
}

func (ac *AdaptiveConfig) adapt() {
	ac.mu.Lock()
	defer ac.mu.Unlock()
	
	switch ac.deviceClass {
	case "constrained", "mobile":
		ac.config = EdgeModeOptimizerConfig()
		ac.config.GCTuning = true
	case "standard":
		ac.config = DefaultOptimizerConfig()
	case "high-memory":
		ac.config = DefaultOptimizerConfig()
		ac.config.StreamingReplay = false
	}
	
	if ac.memoryProfile == "low" {
		ac.config.StreamingReplay = true
		ac.config.BufferReuse = true
	}
}

// GetConfig returns the current optimized configuration.
func (ac *AdaptiveConfig) GetConfig() OptimizerConfig {
	ac.mu.RLock()
	defer ac.mu.RUnlock()
	return ac.config
}

func detectDeviceClass() string {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	// Simplified detection
	totalRAM := m.Sys / (1024 * 1024)
	
	switch {
	case totalRAM < 2048:
		return "constrained"
	case totalRAM < 4096:
		return "mobile"
	case totalRAM < 16384:
		return "standard"
	default:
		return "high-memory"
	}
}

func detectMemoryProfile() string {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	available := m.Sys - m.HeapAlloc
	if available < 512*1024*1024 {
		return "low"
	}
	return "normal"
}

// PerformanceMetrics tracks key performance indicators.
type PerformanceMetrics struct {
	mu sync.RWMutex
	
	EventProcessingTime time.Duration
	HashComputeTime     time.Duration
	RegistryLoadTime    time.Duration
	MemoryUsage         uint64
	GCLatency           time.Duration
}

// Record stores a metric sample.
func (pm *PerformanceMetrics) Record(name string, value time.Duration) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	
	switch name {
	case "event_process":
		pm.EventProcessingTime = value
	case "hash_compute":
		pm.HashComputeTime = value
	case "registry_load":
		pm.RegistryLoadTime = value
	case "gc_latency":
		pm.GCLatency = value
	}
}

// Snapshot returns a copy of current metrics without the mutex.
func (pm *PerformanceMetrics) Snapshot() map[string]any {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return map[string]any{
		"eventProcessingTime": pm.EventProcessingTime,
		"hashComputeTime":     pm.HashComputeTime,
		"registryLoadTime":    pm.RegistryLoadTime,
		"memoryUsage":         pm.MemoryUsage,
		"gcLatency":           pm.GCLatency,
	}
}

// GlobalMetrics is the default metrics collector.
var GlobalMetrics = &PerformanceMetrics{}

// Timer helps measure operation durations.
type Timer struct {
	start time.Time
	name  string
}

// StartTimer begins timing an operation.
func StartTimer(name string) *Timer {
	return &Timer{
		start: time.Now(),
		name:  name,
	}
}

// Stop ends timing and records the metric.
func (t *Timer) Stop() time.Duration {
	elapsed := time.Since(t.start)
	GlobalMetrics.Record(t.name, elapsed)
	return elapsed
}
