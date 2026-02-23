package telemetry

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"
)

// MetricType represents the type of a metric.
type MetricType string

const (
	TypeCounter MetricType = "counter"
	TypeGauge   MetricType = "gauge"
	TypeTimer   MetricType = "timer"
)

// MetricValue represents a metric value.
type MetricValue struct {
	Name      string            `json:"name"`
	Type      MetricType        `json:"type"`
	Value     float64           `json:"value"`
	Timestamp time.Time         `json:"ts"`
	Tags      map[string]string `json:"tags,omitempty"`
}

// Metrics provides in-memory metrics collection with optional file sink.
type Metrics struct {
	mu sync.RWMutex

	// Counters
	counters map[string]*int64

	// Gauges
	gauges map[string]*float64

	// Timers (stored as nanoseconds)
	timers map[string][]time.Duration

	// Tags for all metrics
	tags map[string]string

	// Sink
	sink     io.Writer
	sinkFile *os.File
	sinkPath string
}

// NewMetrics creates a new metrics collector.
func NewMetrics() *Metrics {
	return &Metrics{
		counters: make(map[string]*int64),
		gauges:   make(map[string]*float64),
		timers:   make(map[string][]time.Duration),
		tags:     make(map[string]string),
	}
}

// WithSink sets a file sink for metrics.
func (m *Metrics) WithSink(path string) (*Metrics, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return nil, fmt.Errorf("creating metrics directory: %w", err)
	}

	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, fmt.Errorf("opening metrics file: %w", err)
	}

	m.sink = file
	m.sinkFile = file
	m.sinkPath = path
	return m, nil
}

// CloseSink closes the metrics sink file if open.
func (m *Metrics) CloseSink() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.sinkFile != nil {
		return m.sinkFile.Close()
	}
	return nil
}

// WithTag adds a tag to all metrics.
func (m *Metrics) WithTag(key, value string) *Metrics {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tags[key] = value
	return m
}

// Counter increments a counter metric.
func (m *Metrics) Counter(name string) {
	m.mu.RLock()
	counter, exists := m.counters[name]
	m.mu.RUnlock()

	if !exists {
		m.mu.Lock()
		var newCounter int64
		m.counters[name] = &newCounter
		counter = &newCounter
		m.mu.Unlock()
	}

	atomic.AddInt64(counter, 1)
	m.writeSink(name, TypeCounter, float64(atomic.LoadInt64(counter)))
}

// CounterN increments a counter by n.
func (m *Metrics) CounterN(name string, n int64) {
	m.mu.RLock()
	counter, exists := m.counters[name]
	m.mu.RUnlock()

	if !exists {
		m.mu.Lock()
		var newCounter int64
		m.counters[name] = &newCounter
		counter = &newCounter
		m.mu.Unlock()
	}

	atomic.AddInt64(counter, n)
	m.writeSink(name, TypeCounter, float64(atomic.LoadInt64(counter)))
}

// Gauge sets a gauge metric.
func (m *Metrics) Gauge(name string, value float64) {
	m.mu.Lock()
	m.gauges[name] = &value
	m.mu.Unlock()

	m.writeSink(name, TypeGauge, value)
}

// Timer records a timer metric.
func (m *Metrics) Timer(name string, duration time.Duration) {
	m.mu.Lock()
	m.timers[name] = append(m.timers[name], duration)
	m.mu.Unlock()

	m.writeSink(name, TypeTimer, float64(duration.Nanoseconds()))
}

// Time records the duration of a function.
func (m *Metrics) Time(name string, fn func()) {
	start := time.Now()
	fn()
	m.Timer(name, time.Since(start))
}

// GetCounter returns the current value of a counter.
func (m *Metrics) GetCounter(name string) int64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if counter, ok := m.counters[name]; ok {
		return atomic.LoadInt64(counter)
	}
	return 0
}

// GetGauge returns the current value of a gauge.
func (m *Metrics) GetGauge(name string) float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if gauge, ok := m.gauges[name]; ok {
		return *gauge
	}
	return 0
}

// GetTimerStats returns statistics for a timer.
func (m *Metrics) GetTimerStats(name string) (count int, total time.Duration, avg time.Duration) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	timers, ok := m.timers[name]
	if !ok || len(timers) == 0 {
		return 0, 0, 0
	}

	var sum time.Duration
	for _, d := range timers {
		sum += d
	}
	return len(timers), sum, sum / time.Duration(len(timers))
}

// Snapshot returns a snapshot of all metrics.
func (m *Metrics) Snapshot() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	snapshot := make(map[string]interface{})

	counters := make(map[string]int64)
	for name, counter := range m.counters {
		counters[name] = atomic.LoadInt64(counter)
	}
	snapshot["counters"] = counters

	gauges := make(map[string]float64)
	for name, gauge := range m.gauges {
		gauges[name] = *gauge
	}
	snapshot["gauges"] = gauges

	timers := make(map[string]map[string]interface{})
	for name, times := range m.timers {
		if len(times) == 0 {
			continue
		}
		var sum time.Duration
		var min, max time.Duration
		for i, d := range times {
			sum += d
			if i == 0 || d < min {
				min = d
			}
			if i == 0 || d > max {
				max = d
			}
		}
		timers[name] = map[string]interface{}{
			"count": len(times),
			"sum":   sum.String(),
			"avg":   (sum / time.Duration(len(times))).String(),
			"min":   min.String(),
			"max":   max.String(),
		}
	}
	snapshot["timers"] = timers

	return snapshot
}

// Dump writes all metrics to the sink.
func (m *Metrics) Dump() error {
	if m.sink == nil {
		return nil
	}

	snapshot := m.Snapshot()
	data, err := json.Marshal(snapshot)
	if err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	_, err = fmt.Fprintln(m.sink, string(data))
	return err
}

// writeSink writes a metric to the sink.
func (m *Metrics) writeSink(name string, typ MetricType, value float64) {
	if m.sink == nil {
		return
	}

	m.mu.RLock()
	tags := make(map[string]string, len(m.tags))
	for k, v := range m.tags {
		tags[k] = v
	}
	m.mu.RUnlock()

	metric := MetricValue{
		Name:      name,
		Type:      typ,
		Value:     value,
		Timestamp: time.Now().UTC(),
		Tags:      tags,
	}

	data, _ := json.Marshal(metric)

	m.mu.Lock()
	fmt.Fprintln(m.sink, string(data))
	m.mu.Unlock()
}

// Reset clears all metrics.
func (m *Metrics) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.counters = make(map[string]*int64)
	m.gauges = make(map[string]*float64)
	m.timers = make(map[string][]time.Duration)
}

// defaultMetrics is the package-level metrics instance, initialized lazily.
var defaultMetrics *Metrics
var metricsInitOnce sync.Once

// initDefaultMetrics initializes the default metrics with environment configuration.
// This is called lazily on first use to reduce startup overhead.
func initDefaultMetrics() {
	defaultMetrics = NewMetrics()
	// Initialize sink from environment if configured
	if path := os.Getenv("REACH_METRICS_PATH"); path != "" {
		_, _ = defaultMetrics.WithSink(path)
	}
}

// DefaultMetrics returns the default metrics instance, initializing it on first use.
func DefaultMetrics() *Metrics {
	metricsInitOnce.Do(initDefaultMetrics)
	return defaultMetrics
}

// M is a shorthand for DefaultMetrics().
func M() *Metrics { return DefaultMetrics() }

// InitDefaultSink initializes the default metrics sink from environment.
// Deprecated: Metrics are now initialized lazily. Set REACH_METRICS_PATH before first metrics call.
func InitDefaultSink() error {
	if defaultMetrics != nil {
		if path := os.Getenv("REACH_METRICS_PATH"); path != "" {
			_, err := defaultMetrics.WithSink(path)
			return err
		}
	}
	return nil
}
