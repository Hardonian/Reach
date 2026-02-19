package determinism

import (
	"fmt"
	"sync"
)

// DriftMonitor tracks the "entropy" of deterministic runs.
// In Zeo, reduction of entropy is a core value.
type DriftMonitor struct {
	mu           sync.RWMutex
	goldenOutput map[string]string // PackID_Step -> GoldenHash
	driftCounts  map[string]int    // RunID -> Number of drifted steps
}

// NewDriftMonitor creates a new entropy/drift monitor.
func NewDriftMonitor() *DriftMonitor {
	return &DriftMonitor{
		goldenOutput: make(map[string]string),
		driftCounts:  make(map[string]int),
	}
}

// RegisterStep registers a step's output hash for a pack.
// If it's the first time, it becomes the "Golden Path".
func (m *DriftMonitor) RegisterStep(packID string, stepIndex int, hash string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := fmt.Sprintf("%s_%d", packID, stepIndex)
	if _, ok := m.goldenOutput[key]; !ok {
		m.goldenOutput[key] = hash
	}
}

// CheckDrift compares the current action output hash against the golden path.
// If it differs, it increments the drift count for the run.
func (m *DriftMonitor) CheckDrift(runID, packID string, stepIndex int, currentHash string) (float64, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := fmt.Sprintf("%s_%d", packID, stepIndex)
	golden, ok := m.goldenOutput[key]
	if !ok {
		return 0, false // No golden path yet
	}

	if golden != currentHash {
		m.driftCounts[runID]++
		return 1.0, true // Drifted
	}

	return 0.0, false
}

// GetDriftScore returns the cumulative drift score for a run.
func (m *DriftMonitor) GetDriftScore(runID string) int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.driftCounts[runID]
}
