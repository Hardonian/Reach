// Package historical provides historical intelligence capabilities for Reach runs.
// It enables analysis over time, drift detection, baseline management, trend metrics, and evidence diff visualization.
package historical

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ============================================================================
// HISTORICAL INTELLIGENCE MANAGER
// ============================================================================

// Manager is the main entry point for all historical intelligence features.
type Manager struct {
	index     *LineageIndex
	drift     *DriftDetector
	baseline  *BaselineManager
	trends    *TrendMetricsManager
	diff      *EvidenceDiffManager

	mu       sync.RWMutex
	dataDir  string
}

// Config holds configuration for the historical manager.
type Config struct {
	DataDir string
}

// NewManager creates a new historical intelligence manager.
func NewManager(cfg Config) (*Manager, error) {
	if err := os.MkdirAll(cfg.DataDir, 0o755); err != nil {
		return nil, err
	}

	mgr := &Manager{dataDir: cfg.DataDir}

	// Initialize lineage index
	index, err := NewLineageIndex(cfg.DataDir)
	if err != nil {
		return nil, err
	}
	mgr.index = index

	// Initialize drift detector
	drift, err := NewDriftDetector(filepath.Join(cfg.DataDir, "drift"), index)
	if err != nil {
		index.Close()
		return nil, err
	}
	mgr.drift = drift

	// Initialize baseline manager
	baseline, err := NewBaselineManager(filepath.Join(cfg.DataDir, "baselines"), drift)
	if err != nil {
		drift.Close()
		index.Close()
		return nil, err
	}
	mgr.baseline = baseline

	// Initialize trend metrics manager
	trends, err := NewTrendMetricsManager(filepath.Join(cfg.DataDir, "trends"), drift)
	if err != nil {
		baseline.Close()
		drift.Close()
		index.Close()
		return nil, err
	}
	mgr.trends = trends

	// Initialize evidence diff manager
	diff, err := NewEvidenceDiffManager(filepath.Join(cfg.DataDir, "diff"), index)
	if err != nil {
		trends.Close()
		baseline.Close()
		drift.Close()
		index.Close()
		return nil, err
	}
	mgr.diff = diff

	return mgr, nil
}

// Close closes all underlying managers.
func (m *Manager) Close() error {
	var errors []error

	if m.diff != nil {
		if err := m.diff.Close(); err != nil {
			errors = append(errors, err)
		}
	}
	if m.trends != nil {
		if err := m.trends.Close(); err != nil {
			errors = append(errors, err)
		}
	}
	if m.baseline != nil {
		if err := m.baseline.Close(); err != nil {
			errors = append(errors, err)
		}
	}
	if m.drift != nil {
		if err := m.drift.Close(); err != nil {
			errors = append(errors, err)
		}
	}
	if m.index != nil {
		if err := m.index.Close(); err != nil {
			errors = append(errors, err)
		}
	}

	if len(errors) > 0 {
		// Return first error for simplicity
		return errors[0]
	}
	return nil
}

// Index returns the lineage index.
func (m *Manager) Index() *LineageIndex {
	return m.index
}

// Drift returns the drift detector.
func (m *Manager) Drift() *DriftDetector {
	return m.drift
}

// Baseline returns the baseline manager.
func (m *Manager) Baseline() *BaselineManager {
	return m.baseline
}

// Trends returns the trend metrics manager.
func (m *Manager) Trends() *TrendMetricsManager {
	return m.trends
}

// Diff returns the evidence diff manager.
func (m *Manager) Diff() *EvidenceDiffManager {
	return m.diff
}

// ============================================================================
// SEED DATA GENERATION
// ============================================================================

// SeedHistoricalData generates seed data for testing and demonstration.
func (m *Manager) SeedHistoricalData(ctx context.Context, pipelineID string, numRuns int) error {
	// Generate synthetic historical runs
	tools := []string{"bash", "node", "python", "file_read", "http_get", "http_post", "write_file", "search"}
	plugins := []string{"core", "filesystem", "network", "database", "ml"}

	for i := 0; i < numRuns; i++ {
		runID := generateRunID(pipelineID, i)
		now := time.Now().UTC().AddDate(0, 0, -numRuns+i)
		
		// Generate events for this run
		events := generateSeedEvents(runID, tools, plugins, i)
		
		// Index events
		if err := m.index.IndexRun(ctx, runID, events); err != nil {
			return err
		}

		// Record metrics
		reproScore := 0.95 - float64(i)*0.01 // Slight degradation over time
		trustScore := 0.90 - float64(i)*0.02
		chaosSens := 0.05 + float64(i)*0.01 // Slight increase

		if err := m.drift.RecordRunMetrics(ctx, runID, pipelineID, 
			reproScore, trustScore, chaosSens, len(events), ""); err != nil {
			return err
		}

		// Record step proofs
		for j, event := range events {
			stepKey := extractStepKey(event)
			proofHash := computeStepProofHash(runID, j, event)
			m.drift.RecordStepProof(ctx, runID, stepKey, j, proofHash)
		}

		// Record trend metrics
		m.trends.RecordMetricSnapshot(ctx, pipelineID, runID, "reproducibility_score", reproScore, nil)
		m.trends.RecordMetricSnapshot(ctx, pipelineID, runID, "trust_score", trustScore, nil)
		m.trends.RecordMetricSnapshot(ctx, pipelineID, runID, "chaos_sensitivity", chaosSens, nil)
		m.trends.RecordMetricSnapshot(ctx, pipelineID, runID, "step_count", float64(len(events)), nil)
	}

	return nil
}

func generateRunID(pipelineID string, index int) string {
	return pipelineID + "-run-" + string(rune('a'+index%26))
}

func generateSeedEvents(runID string, tools, plugins []string, runIndex int) []map[string]interface{} {
	events := []map[string]interface{}{}

	// Generate 5-15 events per run
	numEvents := 5 + runIndex%10
	for i := 0; i < numEvents; i++ {
		tool := tools[i%len(tools)]
		plugin := plugins[i%len(plugins)]

		event := map[string]interface{}{
			"type":         "tool.call",
			"tool":         tool,
			"plugin":       plugin,
			"timestamp":    time.Now().Add(time.Duration(i) * time.Second).Format(time.RFC3339),
			"run_id":       runID,
			"step_index":   i,
			"artifact_hash": generateArtifactHash(runID, i),
		}

		// Add some variability
		if i%3 == 0 {
			event["result"] = map[string]interface{}{
				"output": "success",
				"duration_ms": 100 + runIndex*10,
			}
		}

		events = append(events, event)
	}

	return events
}

func generateArtifactHash(runID string, stepIndex int) string {
	data := runID + string(rune('0'+stepIndex))
	hash := sha256.Sum256([]byte(data))
	return fmt.Sprintf("%x", hash[:16])
}