package determinism

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
)

// DriftReport represents a detailed report of fingerprint drift detection.
type DriftReport struct {
	Timestamp       time.Time         `json:"timestamp"`
	RunID           string            `json:"run_id"`
	BaselineHash    string            `json:"baseline_hash"`
	CurrentHash     string            `json:"current_hash"`
	DriftDetected   bool              `json:"drift_detected"`
	DriftScore      float64           `json:"drift_score"`
	TrialNumber     int               `json:"trial_number"`
	FieldDiffs      []FieldDiff       `json:"field_diffs,omitempty"`
	Summary         string            `json:"summary"`
	Severity        string            `json:"severity"` // "info", "warning", "critical"
}

// FieldDiff represents a difference in a specific field.
type FieldDiff struct {
	Path          string      `json:"path"`
	BaselineValue interface{} `json:"baseline_value"`
	CurrentValue  interface{} `json:"current_value"`
	ValueType     string      `json:"value_type"`
	ChangeType    string      `json:"change_type"` // "modified", "added", "removed"
}

// DriftDetector detects and reports fingerprint drift.
type DriftDetector struct {
	baselineHash string
	runID        string
	trialCount   int
	currentTrial int
	fieldDiffs   []FieldDiff
}

// NewDriftDetector creates a new drift detector.
func NewDriftDetector(runID, baselineHash string) *DriftDetector {
	return &DriftDetector{
		baselineHash: baselineHash,
		runID:        runID,
		trialCount:   0,
		currentTrial: 0,
		fieldDiffs:   []FieldDiff{},
	}
}

// RecordTrial records a trial hash for drift detection.
func (d *DriftDetector) RecordTrial(trialNum int, hash string, inputData map[string]interface{}) *DriftReport {
	d.currentTrial = trialNum

	report := &DriftReport{
		Timestamp:     time.Now().UTC(),
		RunID:         d.runID,
		BaselineHash:  d.baselineHash,
		CurrentHash:   hash,
		TrialNumber:   trialNum,
		DriftDetected: hash != d.baselineHash,
	}

	if report.DriftDetected {
		report.DriftScore = 1.0
		report.Severity = "critical"
		report.Summary = fmt.Sprintf("Fingerprint drift detected at trial %d", trialNum)

		// Analyze the field differences if input data is available
		if inputData != nil {
			d.analyzeDrift(inputData, report)
		}
	} else {
		report.DriftScore = 0.0
		report.Severity = "info"
		report.Summary = fmt.Sprintf("No drift detected at trial %d", trialNum)
	}

	return report
}

// analyzeDrift analyzes the drift and identifies field differences.
func (d *DriftDetector) analyzeDrift(inputData map[string]interface{}, report *DriftReport) {
	// Re-hash with canonicalization to see what changed
	canonicalInput := CanonicalJSON(inputData)
	_ = canonicalInput

	// For now, we'll track that drift occurred - the actual field diff
	// would require having the baseline input available
	report.FieldDiffs = d.fieldDiffs
}

// GetReport generates a summary report of all trials.
func (d *DriftDetector) GetReport() *DriftReport {
	report := &DriftReport{
		Timestamp:     time.Now().UTC(),
		RunID:         d.runID,
		BaselineHash:  d.baselineHash,
		DriftDetected: len(d.fieldDiffs) > 0,
		TrialNumber:   d.currentTrial,
	}

	if report.DriftDetected {
		report.DriftScore = 1.0
		report.Severity = "critical"
		report.Summary = fmt.Sprintf("Drift detected after %d trials", d.currentTrial)
		report.FieldDiffs = d.fieldDiffs
	} else {
		report.DriftScore = 0.0
		report.Severity = "info"
		report.Summary = fmt.Sprintf("All %d trials passed without drift", d.currentTrial)
	}

	return report
}

// FormatDriftReport returns a human-readable drift report.
func FormatDriftReport(report *DriftReport) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("=== Drift Report ===\n"))
	sb.WriteString(fmt.Sprintf("Run ID: %s\n", report.RunID))
	sb.WriteString(fmt.Sprintf("Timestamp: %s\n", report.Timestamp.Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("Trial: %d\n\n", report.TrialNumber))

	statusIcon := "✓"
	if report.DriftDetected {
		statusIcon = "✗"
	}
	sb.WriteString(fmt.Sprintf("%s Status: %s\n", statusIcon, report.Summary))
	sb.WriteString(fmt.Sprintf("Severity: %s\n", report.Severity))
	sb.WriteString(fmt.Sprintf("Drift Score: %.2f\n\n", report.DriftScore))

	sb.WriteString(fmt.Sprintf("Baseline Hash: %s\n", report.BaselineHash[:min(16, len(report.BaselineHash))]))
	sb.WriteString(fmt.Sprintf("Current Hash:  %s\n", report.CurrentHash[:min(16, len(report.CurrentHash))]))

	if len(report.FieldDiffs) > 0 {
		sb.WriteString("\nField Differences:\n")
		for _, diff := range report.FieldDiffs {
			sb.WriteString(fmt.Sprintf("  Path: %s\n", diff.Path))
			sb.WriteString(fmt.Sprintf("    Change Type: %s\n", diff.ChangeType))
			sb.WriteString(fmt.Sprintf("    Value Type: %s\n", diff.ValueType))
			if diff.BaselineValue != nil {
				sb.WriteString(fmt.Sprintf("    Baseline: %v\n", diff.BaselineValue))
			}
			if diff.CurrentValue != nil {
				sb.WriteString(fmt.Sprintf("    Current: %v\n", diff.CurrentValue))
			}
		}
	}

	return sb.String()
}

// Min returns the minimum of two integers.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// CompareHashes compares two hashes and returns detailed difference information.
func CompareHashes(hashA, hashB string, dataA, dataB map[string]interface{}) *DriftReport {
	driftDetected := hashA != hashB

	report := &DriftReport{
		Timestamp:     time.Now().UTC(),
		DriftDetected: driftDetected,
		BaselineHash:  hashA,
		CurrentHash:   hashB,
	}

	if driftDetected {
		report.DriftScore = 1.0
		report.Severity = "critical"
		report.Summary = "Hash mismatch detected"

		// Deep compare the data
		if dataA != nil && dataB != nil {
			report.FieldDiffs = deepCompareMaps(dataA, dataB, "")
		}
	} else {
		report.DriftScore = 0.0
		report.Severity = "info"
		report.Summary = "Hashes match"
	}

	return report
}

// deepCompareMaps performs a deep comparison of two maps.
func deepCompareMaps(a, b map[string]interface{}, path string) []FieldDiff {
	var diffs []FieldDiff

	// Get all keys from both maps
	keys := make(map[string]bool)
	for k := range a {
		keys[k] = true
	}
	for k := range b {
		keys[k] = true
	}

	// Sort keys for deterministic comparison
	sortedKeys := make([]string, 0, len(keys))
	for k := range keys {
		sortedKeys = append(sortedKeys, k)
	}
	sort.Strings(sortedKeys)

	for _, k := range sortedKeys {
		currentPath := k
		if path != "" {
			currentPath = path + "." + k
		}

		valA, okA := a[k]
		valB, okB := b[k]

		if !okA {
			diffs = append(diffs, FieldDiff{
				Path:          currentPath,
				CurrentValue:  valB,
				ValueType:     fmt.Sprintf("%T", valB),
				ChangeType:    "added",
			})
			continue
		}

		if !okB {
			diffs = append(diffs, FieldDiff{
				Path:          currentPath,
				BaselineValue: valA,
				ValueType:     fmt.Sprintf("%T", valA),
				ChangeType:    "removed",
			})
			continue
		}

		// Compare values
		if fmt.Sprintf("%v", valA) != fmt.Sprintf("%v", valB) {
			diffs = append(diffs, FieldDiff{
				Path:          currentPath,
				BaselineValue: valA,
				CurrentValue:  valB,
				ValueType:     fmt.Sprintf("%T", valB),
				ChangeType:    "modified",
			})
		}
	}

	return diffs
}

// ToJSON returns the drift report as JSON.
func (r *DriftReport) ToJSON() (string, error) {
	b, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal drift report: %w", err)
	}
	return string(b), nil
}

// DriftReportFromJSON parses a drift report from JSON.
func DriftReportFromJSON(data string) (*DriftReport, error) {
	var report DriftReport
	err := json.Unmarshal([]byte(data), &report)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal drift report: %w", err)
	}
	return &report, nil
}
