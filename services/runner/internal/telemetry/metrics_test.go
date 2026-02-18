package telemetry

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestNewMetrics(t *testing.T) {
	m := NewMetrics()
	if m == nil {
		t.Fatal("NewMetrics() returned nil")
	}
}

func TestCounter(t *testing.T) {
	m := NewMetrics()

	m.Counter("runs_started")
	m.Counter("runs_started")
	m.Counter("runs_started")

	if count := m.GetCounter("runs_started"); count != 3 {
		t.Errorf("expected counter=3, got: %d", count)
	}
}

func TestCounterN(t *testing.T) {
	m := NewMetrics()

	m.CounterN("events", 10)
	m.CounterN("events", 5)

	if count := m.GetCounter("events"); count != 15 {
		t.Errorf("expected counter=15, got: %d", count)
	}
}

func TestGauge(t *testing.T) {
	m := NewMetrics()

	m.Gauge("active_runs", 5)
	if val := m.GetGauge("active_runs"); val != 5 {
		t.Errorf("expected gauge=5, got: %f", val)
	}

	m.Gauge("active_runs", 3)
	if val := m.GetGauge("active_runs"); val != 3 {
		t.Errorf("expected gauge=3, got: %f", val)
	}
}

func TestTimer(t *testing.T) {
	m := NewMetrics()

	m.Timer("request_duration", 100*time.Millisecond)
	m.Timer("request_duration", 200*time.Millisecond)
	m.Timer("request_duration", 300*time.Millisecond)

	count, total, avg := m.GetTimerStats("request_duration")
	if count != 3 {
		t.Errorf("expected count=3, got: %d", count)
	}
	if total != 600*time.Millisecond {
		t.Errorf("expected total=600ms, got: %v", total)
	}
	if avg != 200*time.Millisecond {
		t.Errorf("expected avg=200ms, got: %v", avg)
	}
}

func TestTime(t *testing.T) {
	m := NewMetrics()

	m.Time("operation", func() {
		time.Sleep(10 * time.Millisecond)
	})

	count, _, _ := m.GetTimerStats("operation")
	if count != 1 {
		t.Errorf("expected count=1, got: %d", count)
	}
}

func TestMetricsWithTag(t *testing.T) {
	m := NewMetrics()
	m.WithTag("env", "test")

	m.Counter("requests")

	if count := m.GetCounter("requests"); count != 1 {
		t.Errorf("expected counter=1, got: %d", count)
	}
}

func TestMetricsSnapshot(t *testing.T) {
	m := NewMetrics()

	m.Counter("counter1")
	m.Gauge("gauge1", 42)
	m.Timer("timer1", 100*time.Millisecond)

	snapshot := m.Snapshot()
	if snapshot == nil {
		t.Fatal("Snapshot() returned nil")
	}

	counters, ok := snapshot["counters"].(map[string]int64)
	if !ok {
		t.Fatal("expected counters in snapshot")
	}
	if counters["counter1"] != 1 {
		t.Errorf("expected counter1=1, got: %d", counters["counter1"])
	}

	gauges, ok := snapshot["gauges"].(map[string]float64)
	if !ok {
		t.Fatal("expected gauges in snapshot")
	}
	if gauges["gauge1"] != 42 {
		t.Errorf("expected gauge1=42, got: %f", gauges["gauge1"])
	}
}

func TestMetricsReset(t *testing.T) {
	m := NewMetrics()

	m.Counter("test")
	m.Reset()

	if count := m.GetCounter("test"); count != 0 {
		t.Errorf("expected counter=0 after reset, got: %d", count)
	}
}

func TestMetricsWithSink(t *testing.T) {
	tmpDir := t.TempDir()
	sinkPath := filepath.Join(tmpDir, "metrics.json")

	m := NewMetrics()
	_, err := m.WithSink(sinkPath)
	if err != nil {
		t.Fatalf("failed to create sink: %v", err)
	}
	defer m.CloseSink()

	m.Counter("test_counter")

	// Check file exists
	if _, err := os.Stat(sinkPath); os.IsNotExist(err) {
		t.Error("sink file should exist")
	}
}

func TestDefaultMetrics(t *testing.T) {
	// Reset default metrics for testing
	defaultMetrics = NewMetrics()

	M().Counter("default_test")
	if count := DefaultMetrics().GetCounter("default_test"); count != 1 {
		t.Errorf("expected default counter=1, got: %d", count)
	}
}
