package telemetry

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// PackMetrics tracks telemetry for a specific pack.
type PackMetrics struct {
	PackID              string    `json:"pack_id"`
	ExecutionCount      int       `json:"execution_count"`
	FailureRate         float64   `json:"failure_rate"`
	PolicyViolationRate float64   `json:"policy_violation_rate"`
	ToolMisuseRate      float64   `json:"tool_misuse_rate"`
	AvgLatency          float64   `json:"avg_latency_ms"`
	TotalTokens         int       `json:"total_tokens"`
	AvgTokens           float64   `json:"avg_tokens"`
	EstimatedCost       float64   `json:"estimated_cost_usd"`
	LastExecutedAt      time.Time `json:"last_executed_at"`

	mu sync.RWMutex
}

// PackTelemetry handles persistence of pack metrics.
type PackTelemetry struct {
	BaseDir string
}

// NewPackTelemetry creates a new pack telemetry manager.
func NewPackTelemetry() *PackTelemetry {
	return &PackTelemetry{
		BaseDir: "telemetry/packs",
	}
}

// RecordExecution logs telemetry for a pack run.
func (pt *PackTelemetry) RecordExecution(packID string, success bool, policyViolation bool, toolMisuse bool, latency time.Duration, tokens int, cost float64) error {
	mu_global.Lock()
	defer mu_global.Unlock()

	metrics, err := pt.LoadMetrics(packID)
	if err != nil {
		metrics = &PackMetrics{PackID: packID}
	}

	metrics.mu.Lock()
	defer metrics.mu.Unlock()

	metrics.ExecutionCount++
	metrics.LastExecutedAt = time.Now().UTC()

	// Update failure rate
	if !success {
		metrics.FailureRate = (metrics.FailureRate*float64(metrics.ExecutionCount-1) + 1.0) / float64(metrics.ExecutionCount)
	} else {
		metrics.FailureRate = (metrics.FailureRate * float64(metrics.ExecutionCount-1)) / float64(metrics.ExecutionCount)
	}

	// Update violations
	if policyViolation {
		metrics.PolicyViolationRate = (metrics.PolicyViolationRate*float64(metrics.ExecutionCount-1) + 1.0) / float64(metrics.ExecutionCount)
	}
	if toolMisuse {
		metrics.ToolMisuseRate = (metrics.ToolMisuseRate*float64(metrics.ExecutionCount-1) + 1.0) / float64(metrics.ExecutionCount)
	}

	// Update latency and tokens
	metrics.AvgLatency = (metrics.AvgLatency*float64(metrics.ExecutionCount-1) + float64(latency.Milliseconds())) / float64(metrics.ExecutionCount)
	metrics.TotalTokens += tokens
	metrics.AvgTokens = float64(metrics.TotalTokens) / float64(metrics.ExecutionCount)
	metrics.EstimatedCost += cost

	return pt.SaveMetrics(metrics)
}

var mu_global sync.Mutex // Real global lock for file access

// LoadMetrics loads metrics from disk.
func (pt *PackTelemetry) LoadMetrics(packID string) (*PackMetrics, error) {
	path := filepath.Join(pt.BaseDir, fmt.Sprintf("%s.json", packID))
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var m PackMetrics
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// SaveMetrics saves metrics to disk.
func (pt *PackTelemetry) SaveMetrics(m *PackMetrics) error {
	path := filepath.Join(pt.BaseDir, fmt.Sprintf("%s.json", m.PackID))
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
