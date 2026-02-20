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
	SuccessCount        int       `json:"success_count"`
	FailureCount        int       `json:"failure_count"`
	FailureRate         float64   `json:"failure_rate"`
	PolicyViolationCount int      `json:"policy_violation_count"`
	PolicyViolationRate float64   `json:"policy_violation_rate"`
	ToolMisuseCount     int       `json:"tool_misuse_count"`
	ToolMisuseRate      float64   `json:"tool_misuse_rate"`
	AvgLatency          float64   `json:"avg_latency_ms"`
	TotalTokens         int       `json:"total_tokens"`
	AvgTokens           float64   `json:"avg_tokens"`
	EstimatedCost       float64   `json:"estimated_cost_usd"`
	LastExecutedAt      time.Time `json:"last_executed_at"`

	mu sync.RWMutex `json:"-"`
}

// PackTelemetry handles persistence of pack metrics.
type PackTelemetry struct {
	BaseDir string
	mu      sync.Mutex // Instance-level lock for file access
}

// NewPackTelemetry creates a new pack telemetry manager.
func NewPackTelemetry() *PackTelemetry {
	return &PackTelemetry{
		BaseDir: "telemetry/packs",
	}
}

// RecordExecution logs telemetry for a pack run.
func (pt *PackTelemetry) RecordExecution(packID string, success bool, policyViolation bool, toolMisuse bool, latency time.Duration, tokens int, cost float64) error {
	pt.mu.Lock()
	defer pt.mu.Unlock()

	metrics, err := pt.LoadMetrics(packID)
	if err != nil {
		metrics = &PackMetrics{PackID: packID}
	}

	metrics.ExecutionCount++
	metrics.LastExecutedAt = time.Now().UTC()

	// Track absolute counts for accurate rate computation
	if success {
		metrics.SuccessCount++
	} else {
		metrics.FailureCount++
	}
	metrics.FailureRate = float64(metrics.FailureCount) / float64(metrics.ExecutionCount)

	if policyViolation {
		metrics.PolicyViolationCount++
	}
	metrics.PolicyViolationRate = float64(metrics.PolicyViolationCount) / float64(metrics.ExecutionCount)

	if toolMisuse {
		metrics.ToolMisuseCount++
	}
	metrics.ToolMisuseRate = float64(metrics.ToolMisuseCount) / float64(metrics.ExecutionCount)

	// Update latency and tokens
	metrics.AvgLatency = (metrics.AvgLatency*float64(metrics.ExecutionCount-1) + float64(latency.Milliseconds())) / float64(metrics.ExecutionCount)
	metrics.TotalTokens += tokens
	metrics.AvgTokens = float64(metrics.TotalTokens) / float64(metrics.ExecutionCount)
	metrics.EstimatedCost += cost

	return pt.SaveMetrics(metrics)
}

// LoadMetrics loads metrics from disk.
func (pt *PackTelemetry) LoadMetrics(packID string) (*PackMetrics, error) {
	p := filepath.Join(pt.BaseDir, fmt.Sprintf("%s.json", packID))
	data, err := os.ReadFile(p)
	if err != nil {
		return nil, err
	}
	var m PackMetrics
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// SaveMetrics saves metrics to disk with atomic write.
func (pt *PackTelemetry) SaveMetrics(m *PackMetrics) error {
	if err := os.MkdirAll(pt.BaseDir, 0755); err != nil {
		return fmt.Errorf("creating pack telemetry directory: %w", err)
	}

	target := filepath.Join(pt.BaseDir, fmt.Sprintf("%s.json", m.PackID))
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}

	// Atomic write: write to temp file then rename
	tmp := target + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return fmt.Errorf("writing temp metrics file: %w", err)
	}
	if err := os.Rename(tmp, target); err != nil {
		os.Remove(tmp) // best-effort cleanup
		return fmt.Errorf("atomic rename of metrics file: %w", err)
	}
	return nil
}
