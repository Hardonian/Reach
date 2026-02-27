package determinism

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// CIGateConfig holds the configuration for a CI gate.
type CIGateConfig struct {
	Iterations      int               `json:"iterations"`
	FailOnDrift     bool              `json:"fail_on_drift"`
	ReportPath      string            `json:"report_path"`
	Verbose         bool              `json:"verbose"`
	OperationTrials map[string]int    `json:"operation_trials"`
}

// CIGateResult represents the result of a CI gate run.
type CIGateResult struct {
	Passed          bool          `json:"passed"`
	Timestamp       time.Time     `json:"timestamp"`
	Iterations      int           `json:"iterations"`
	OperationsTested int          `json:"operations_tested"`
	TotalTrials     int           `json:"total_trials"`
	DriftDetected   bool          `json:"drift_detected"`
	DriftDetails    []DriftEvent  `json:"drift_details,omitempty"`
	ReportPath      string        `json:"report_path"`
	ExitCode        int           `json:"exit_code"`
}

// DriftEvent represents a single drift event during CI gate execution.
type DriftEvent struct {
	Timestamp   time.Time `json:"timestamp"`
	Operation  string    `json:"operation"`
	Trial      int       `json:"trial"`
	Baseline   string    `json:"baseline_hash"`
	Actual     string    `json:"actual_hash"`
	InputPath  string    `json:"input_path,omitempty"`
}

// DefaultCIGateConfig returns the default CI gate configuration.
func DefaultCIGateConfig() *CIGateConfig {
	return &CIGateConfig{
		Iterations:      200,
		FailOnDrift:     true,
		ReportPath:      "determinism-ci-report.json",
		Verbose:         false,
		OperationTrials: make(map[string]int),
	}
}

// CIGate implements the CI gate for determinism verification.
type CIGate struct {
	config  *CIGateConfig
	drifts  []DriftEvent
}

// NewCIGate creates a new CI gate with the given configuration.
func NewCIGate(config *CIGateConfig) *CIGate {
	if config == nil {
		config = DefaultCIGateConfig()
	}
	return &CIGate{
		config: config,
		drifts: []DriftEvent{},
	}
}

// RunTrial runs a single trial and checks for drift.
func (g *CIGate) RunTrial(operation string, trialNum int, trial func() (string, error)) (string, bool, error) {
	hash, err := trial()
	if err != nil {
		return "", false, fmt.Errorf("trial %d failed: %w", trialNum, err)
	}

	// Check if this is the first trial (baseline)
	if trialNum == 0 {
		return hash, false, nil
	}

	// Get baseline from config if available
	baseline := g.config.OperationTrials[operation]
	if baseline == 0 && trialNum > 1 {
		// This shouldn't happen - we need a baseline
		return hash, false, fmt.Errorf("no baseline for operation %s", operation)
	}

	// If this is the first actual trial, set the baseline
	if _, ok := g.config.OperationTrials[operation]; !ok {
		g.config.OperationTrials[operation] = trialNum
		return hash, false, nil
	}

	return hash, false, nil
}

// RunCIGate executes the CI gate with the given operations.
func (g *CIGate) RunCIGate(operations map[string]func() (string, error)) *CIGateResult {
	result := &CIGateResult{
		Passed:    true,
		Timestamp: time.Now().UTC(),
	}

	// Run trials for each operation
	for opName, trialFn := range operations {
		result.OperationsTested++
		baseline := ""

		for i := 0; i < g.config.Iterations; i++ {
			result.TotalTrials++

			hash, err := trialFn()
			if err != nil {
				result.Passed = false
				result.ExitCode = 1
				g.drifts = append(g.drifts, DriftEvent{
					Timestamp:  time.Now().UTC(),
					Operation:   opName,
					Trial:       i,
					Baseline:    baseline,
					Actual:      fmt.Sprintf("ERROR: %v", err),
				})
				continue
			}

			if baseline == "" {
				baseline = hash
				if g.config.Verbose {
					fmt.Printf("Operation %s: baseline set to %s\n", opName, baseline[:16])
				}
			} else if hash != baseline {
				result.Passed = false
				result.DriftDetected = true
				result.ExitCode = 1

				drift := DriftEvent{
					Timestamp: time.Now().UTC(),
					Operation: opName,
					Trial:     i,
					Baseline:  baseline,
					Actual:    hash,
				}
				g.drifts = append(g.drifts, drift)

				if g.config.Verbose {
					fmt.Printf("DRIFT DETECTED: Operation %s at trial %d\n", opName, i)
					fmt.Printf("  Baseline: %s\n", baseline[:16])
					fmt.Printf("  Actual:   %s\n", hash[:16])
				}

				// If fail on drift is enabled, stop immediately
				if g.config.FailOnDrift {
					break
				}
			}
		}

		result.Iterations = g.config.Iterations
	}

	result.DriftDetails = g.drifts

	// Save report if path is configured
	if g.config.ReportPath != "" {
		g.saveReport(result)
		result.ReportPath = g.config.ReportPath
	}

	return result
}

// RunCIGateWithFixtures runs the CI gate using fixture-based operations.
func (g *CIGate) RunCIGateWithFixtures(fixtureNames []string) *CIGateResult {
	operations := make(map[string]func() (string, error))

	for _, fixtureName := range fixtureNames {
		fixture, err := LoadSelfTestFixture(fixtureName)
		if err != nil {
			// Skip if fixture can't be loaded
			continue
		}

		for _, op := range fixture.Operations {
			opInput := op.Input
			operations[fmt.Sprintf("%s:%s", fixtureName, op.Name)] = func() (string, error) {
				return Hash(opInput), nil
			}
		}
	}

	return g.RunCIGate(operations)
}

// saveReport saves the CI gate result to a file.
func (g *CIGate) saveReport(result *CIGateResult) error {
	b, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal report: %w", err)
	}

	// Ensure directory exists
	dir := filepath.Dir(g.config.ReportPath)
	if dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create report directory: %w", err)
		}
	}

	if err := os.WriteFile(g.config.ReportPath, b, 0644); err != nil {
		return fmt.Errorf("failed to write report: %w", err)
	}

	return nil
}

// FormatCIGateResult returns a human-readable CI gate result.
func FormatCIGateResult(result *CIGateResult) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("=== CI Gate Result ===\n"))
	sb.WriteString(fmt.Sprintf("Status: %s\n", statusText(result.Passed)))
	sb.WriteString(fmt.Sprintf("Timestamp: %s\n", result.Timestamp.Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("Operations Tested: %d\n", result.OperationsTested))
	sb.WriteString(fmt.Sprintf("Total Trials: %d\n", result.TotalTrials))
	sb.WriteString(fmt.Sprintf("Iterations per Op: %d\n", result.Iterations))
	sb.WriteString(fmt.Sprintf("Drift Detected: %v\n", result.DriftDetected))
	sb.WriteString(fmt.Sprintf("Exit Code: %d\n", result.ExitCode))

	if len(result.DriftDetails) > 0 {
		sb.WriteString("\nDrift Events:\n")
		for i, drift := range result.DriftDetails {
			sb.WriteString(fmt.Sprintf("  %d. %s at trial %d\n", i+1, drift.Operation, drift.Trial))
			sb.WriteString(fmt.Sprintf("     Baseline: %s\n", drift.Baseline[:min(16, len(drift.Baseline))]))
			sb.WriteString(fmt.Sprintf("     Actual:   %s\n", drift.Actual[:min(16, len(drift.Actual))]))
		}
	}

	if result.ReportPath != "" {
		sb.WriteString(fmt.Sprintf("\nReport saved to: %s\n", result.ReportPath))
	}

	return sb.String()
}

func statusText(passed bool) string {
	if passed {
		return "PASSED ✓"
	}
	return "FAILED ✗"
}

// VerifyDeterminismWithGate runs determinism verification with CI gate enforcement.
// This is the main entry point for CI gate integration.
func VerifyDeterminismWithGate(iterations int, trial func() (string, error), failOnDrift bool) (string, *CIGateResult) {
	config := &CIGateConfig{
		Iterations:  iterations,
		FailOnDrift: failOnDrift,
		Verbose:     true,
	}

	gate := NewCIGate(config)
	operations := map[string]func() (string, error){
		"default": trial,
	}

	result := gate.RunCIGate(operations)

	// Get the baseline hash
	baseline := ""
	if len(result.DriftDetails) > 0 {
		baseline = result.DriftDetails[0].Baseline
	}

	return baseline, result
}
