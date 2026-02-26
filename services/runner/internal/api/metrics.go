package api

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
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

// ObserveExecution records an execution time for metrics collection
// d is the execution duration in seconds
func (m *metrics) ObserveExecution(d time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.totalExecutions++
	m.executionTimes = appendWindow(m.executionTimes, d.Seconds())
}

// IncTotalExecutions increments the total executions counter
func (m *metrics) IncTotalExecutions() {
	atomic.AddUint64(&m.totalExecutions, 1)
}

// CASHit records a CAS hit
func (m *metrics) CASHit() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.casMetrics.Hits++
}

// CASMiss records a CAS miss
func (m *metrics) CASMiss() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.casMetrics.Misses++
}

// SetQueueDepth sets the current queue depth
func (m *metrics) SetQueueDepth(depth int32) {
	atomic.StoreInt32(&m.queueDepth, depth)
}

// IncDaemonRestarts increments the daemon restarts counter
func (m *metrics) IncDaemonRestarts() {
	atomic.AddUint64(&m.daemonRestarts, 1)
}

// SetMemoryUsage sets the current memory usage in bytes (RSS)
func (m *metrics) SetMemoryUsage(bytes uint64) {
	atomic.StoreUint64(&m.memoryUsageBytes, bytes)
}

// Uptime returns the daemon uptime
func (m *metrics) Uptime() time.Duration {
	return time.Since(m.startTime)
}

// Fixed-point latency calculations

// secondsToMicros converts seconds to fixed-point microseconds
func secondsToMicros(seconds float64) FixedPointMicros {
	return FixedPointMicros(seconds * 1_000_000)
}

// computeLatencyPercentiles computes p50, p95, p99 latencies in microseconds
func (m *metrics) computeLatencyPercentiles() LatencyPercentiles {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.executionTimes) == 0 {
		return LatencyPercentiles{}
	}

	sorted := make([]float64, len(m.executionTimes))
	copy(sorted, m.executionTimes)
	sort.Float64s(sorted)

	return LatencyPercentiles{
		P50: secondsToMicros(percentile(sorted, 0.50)),
		P95: secondsToMicros(percentile(sorted, 0.95)),
		P99: secondsToMicros(percentile(sorted, 0.99)),
	}
}

// avgExecTimeMicros returns the average execution time in microseconds
func (m *metrics) avgExecTimeMicros() FixedPointMicros {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.executionTimes) == 0 {
		return 0
	}

	var sum float64
	for _, t := range m.executionTimes {
		sum += t
	}
	return secondsToMicros(sum / float64(len(m.executionTimes)))
}

func appendWindow(dst []float64, value float64) []float64 {
	const maxSamples = 4096
	dst = append(dst, value)
	if len(dst) > maxSamples {
		dst = dst[len(dst)-maxSamples:]
	}
	return dst
}

// percentiles computes p50 and p95 from input slice
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

// percentile computes a single percentile value from a sorted slice
func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	idx := int(float64(len(sorted)-1) * p)
	if idx < 0 {
		idx = 0
	}
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
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
	// New metrics for prometheus output
	b.WriteString("# HELP reach_total_executions_total total number of executions\n")
	b.WriteString("# TYPE reach_total_executions_total counter\n")
	fmt.Fprintf(&b, "reach_total_executions_total %d\n", m.totalExecutions)

	b.WriteString("# HELP reach_daemon_restarts_total daemon restart count\n")
	b.WriteString("# TYPE reach_daemon_restarts_total counter\n")
	fmt.Fprintf(&b, "reach_daemon_restarts_total %d\n", m.daemonRestarts)

	b.WriteString("# HELP reach_queue_depth current queue depth\n")
	b.WriteString("# TYPE reach_queue_depth gauge\n")
	fmt.Fprintf(&b, "reach_queue_depth %d\n", m.queueDepth)

	b.WriteString("# HELP reach_memory_usage_bytes memory usage (RSS) in bytes\n")
	b.WriteString("# TYPE reach_memory_usage_bytes gauge\n")
	fmt.Fprintf(&b, "reach_memory_usage_bytes %d\n", m.memoryUsageBytes)

	b.WriteString("# HELP reach_cas_hit_rate_ppm CAS hit rate in PPM\n")
	b.WriteString("# TYPE reach_cas_hit_rate_ppm gauge\n")
	fmt.Fprintf(&b, "reach_cas_hit_rate_ppm %d\n", m.casMetrics.HitRate())

	b.WriteString("# HELP reach_avg_exec_time_micros average execution time in microseconds\n")
	b.WriteString("# TYPE reach_avg_exec_time_micros gauge\n")
	fmt.Fprintf(&b, "reach_avg_exec_time_micros %d\n", m.avgExecTimeMicros())

	return b.String()
}

// JSONMetrics represents the structured JSON output for metrics
type JSONMetrics struct {
	TotalExecutions  uint64               `json:"total_executions"`
	AvgExecTime      FixedPointMicros     `json:"avg_exec_time"` // in microseconds
	Latencies        *LatencyPercentiles  `json:"latencies"`
	CASHitRate       uint64               `json:"cas_hit_rate_ppm"` // parts per million
	QueueDepth       int32                `json:"queue_depth"`
	DaemonRestarts   uint64               `json:"daemon_restarts"`
	MemoryUsage      uint64               `json:"memory_usage_bytes"` // RSS in bytes
	UptimeSeconds    float64              `json:"uptime_seconds"`
}

// ToJSON returns the metrics as JSON string
func (m *metrics) ToJSON(cfg MetricsConfig) (string, error) {
	latencies := m.computeLatencyPercentiles()
	m.mu.Lock()
	casHitRate := m.casMetrics.HitRate()
	m.mu.Unlock()

	result := JSONMetrics{
		TotalExecutions: atomic.LoadUint64(&m.totalExecutions),
		AvgExecTime:     m.avgExecTimeMicros(),
		CASHitRate:      casHitRate,
		QueueDepth:      atomic.LoadInt32(&m.queueDepth),
		DaemonRestarts:  atomic.LoadUint64(&m.daemonRestarts),
		MemoryUsage:     atomic.LoadUint64(&m.memoryUsageBytes),
		UptimeSeconds:   time.Since(m.startTime).Seconds(),
	}

	if cfg.IncludeLatencies {
		result.Latencies = &latencies
	}

	data, err := json.Marshal(result)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
