package api

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// MetricsConfig defines what metrics to include in JSON output
type MetricsConfig struct {
	IncludeLatencies      bool `json:"include_latencies"`
	IncludeQueueDepth      bool `json:"include_queue_depth"`
	IncludeMemoryUsage     bool `json:"include_memory_usage"`
	IncludeCASHitRate      bool `json:"include_cas_hit_rate"`
}

// DefaultMetricsConfig returns the default configuration for metrics
func DefaultMetricsConfig() MetricsConfig {
	return MetricsConfig{
		IncludeLatencies:      true,
		IncludeQueueDepth:     true,
		IncludeMemoryUsage:    true,
		IncludeCASHitRate:     true,
	}
}

// Fixed-point latency values in microseconds
type FixedPointMicros uint64

// LatencyPercentiles holds fixed-point percentile values in microseconds
type LatencyPercentiles struct {
	P50 FixedPointMicros `json:"p50"`
	P95 FixedPointMicros `json:"p95"`
	P99 FixedPointMicros `json:"p99"`
}

// CASMetrics tracks Compare-And-Swap hit rate in PPM (parts per million)
type CASMetrics struct {
	Hits   uint64 `json:"hits"`
	Misses uint64 `json:"misses"`
}

// HitRate returns the hit rate as PPM (parts per million)
func (c *CASMetrics) HitRate() uint64 {
	total := c.Hits + c.Misses
	if total == 0 {
		return 0
	}
	return (c.Hits * 1000000) / total
}

type metrics struct {
	mu                  sync.Mutex
	requestDurations    map[string][]float64
	triggerLatency      []float64
	approvalLatency     []float64
	sseQueueDepth       map[string]int
	sseDropped          map[string]uint64
	invariantViolations map[string]uint64
	// New metrics fields
	totalExecutions     uint64
	executionTimes      []float64 // Store in seconds for internal use
	casMetrics          CASMetrics
	queueDepth          int32 // Current pending jobs (atomic)
	daemonRestarts     uint64
	memoryUsageBytes   uint64 // RSS in bytes
	startTime          time.Time
}

func newMetrics() *metrics {
	return &metrics{
		requestDurations:    map[string][]float64{},
		triggerLatency:      []float64{},
		approvalLatency:     []float64{},
		sseQueueDepth:       map[string]int{},
		sseDropped:          map[string]uint64{},
		invariantViolations: map[string]uint64{},
		executionTimes:      []float64{},
		casMetrics:          CASMetrics{},
		queueDepth:          0,
		startTime:           time.Now(),
	}
}

func (m *metrics) observeRequest(endpoint string, d time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.requestDurations == nil {
		m.requestDurations = make(map[string][]float64)
	}
	m.requestDurations[endpoint] = appendWindow(m.requestDurations[endpoint], d.Seconds())
}

func (m *metrics) observeTriggerLatency(d time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.triggerLatency = appendWindow(m.triggerLatency, d.Seconds())
}

func (m *metrics) observeApprovalLatency(d time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.approvalLatency = appendWindow(m.approvalLatency, d.Seconds())
}

func (m *metrics) setSSEQueueDepth(runID string, depth int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.sseQueueDepth == nil {
		m.sseQueueDepth = make(map[string]int)
	}
	m.sseQueueDepth[runID] = depth
}

func (m *metrics) incSSEDropped(runID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.sseDropped == nil {
		m.sseDropped = make(map[string]uint64)
	}
	m.sseDropped[runID]++
}

func (m *metrics) RecordInvariantViolation(name string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.invariantViolations == nil {
		m.invariantViolations = make(map[string]uint64)
	}
	m.invariantViolations[name]++
}

func appendWindow(dst []float64, value float64) []float64 {
	const maxSamples = 4096
	dst = append(dst, value)
	if len(dst) > maxSamples {
		dst = dst[len(dst)-maxSamples:]
	}
	return dst
}

func percentiles(in []float64) (float64, float64) {
	if len(in) == 0 {
		return 0, 0
	}
	cp := append([]float64(nil), in...)
	sort.Float64s(cp)
	at := func(p float64) float64 {
		idx := int(float64(len(cp)-1) * p)
		if idx < 0 {
			idx = 0
		}
		if idx >= len(cp) {
			idx = len(cp) - 1
		}
		return cp[idx]
	}
	return at(0.50), at(0.95)
}

func (m *metrics) prometheus() string {
	m.mu.Lock()
	defer m.mu.Unlock()

	var b strings.Builder
	b.WriteString("# HELP reach_request_duration_seconds request duration by endpoint\n")
	b.WriteString("# TYPE reach_request_duration_seconds summary\n")
	for endpoint, samples := range m.requestDurations {
		p50, p95 := percentiles(samples)
		fmt.Fprintf(&b, "reach_request_duration_seconds{endpoint=%q,quantile=\"0.50\"} %.6f\n", endpoint, p50)
		fmt.Fprintf(&b, "reach_request_duration_seconds{endpoint=%q,quantile=\"0.95\"} %.6f\n", endpoint, p95)
	}
	p50, p95 := percentiles(m.triggerLatency)
	b.WriteString("# HELP reach_trigger_latency_seconds trigger latency from request start to enqueue\n")
	b.WriteString("# TYPE reach_trigger_latency_seconds summary\n")
	fmt.Fprintf(&b, "reach_trigger_latency_seconds{quantile=\"0.50\"} %.6f\n", p50)
	fmt.Fprintf(&b, "reach_trigger_latency_seconds{quantile=\"0.95\"} %.6f\n", p95)

	p50, p95 = percentiles(m.approvalLatency)
	b.WriteString("# HELP reach_approval_latency_seconds approval endpoint latency\n")
	b.WriteString("# TYPE reach_approval_latency_seconds summary\n")
	fmt.Fprintf(&b, "reach_approval_latency_seconds{quantile=\"0.50\"} %.6f\n", p50)
	fmt.Fprintf(&b, "reach_approval_latency_seconds{quantile=\"0.95\"} %.6f\n", p95)

	b.WriteString("# HELP reach_invariant_violations_total invariant violations observed in runtime paths\n")
	b.WriteString("# TYPE reach_invariant_violations_total counter\n")
	for name, total := range m.invariantViolations {
		fmt.Fprintf(&b, "reach_invariant_violations_total{name=%q} %d\n", name, total)
	}
	b.WriteString("# HELP reach_sse_broadcast_queue_depth per-run SSE queue depth\n")
	b.WriteString("# TYPE reach_sse_broadcast_queue_depth gauge\n")
	for runID, depth := range m.sseQueueDepth {
		fmt.Fprintf(&b, "reach_sse_broadcast_queue_depth{run_id=%q} %d\n", runID, depth)
	}
	b.WriteString("# HELP reach_sse_dropped_events_total dropped low-priority SSE events\n")
	b.WriteString("# TYPE reach_sse_dropped_events_total counter\n")
	for runID, dropped := range m.sseDropped {
		fmt.Fprintf(&b, "reach_sse_dropped_events_total{run_id=%q} %d\n", runID, dropped)
	}
	return b.String()
}
