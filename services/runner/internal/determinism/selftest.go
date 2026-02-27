package determinism

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// SelfTestFixture represents a self-test fixture file.
type SelfTestFixture struct {
	FixtureVersion string          `json:"fixture_version"`
	FixtureType    string          `json:"fixture_type"`
	Description   string          `json:"description"`
	Iterations    int             `json:"iterations"`
	Operations    []SelfTestOp    `json:"operations"`
	PassCondition string          `json:"pass_condition"`
	FailureCode   string          `json:"failure_code"`
}

// SelfTestOp represents a single operation to test.
type SelfTestOp struct {
	Name            string      `json:"name"`
	Description     string      `json:"description"`
	Input           interface{} `json:"input"`
	ExpectedStable bool        `json:"expected_stable"`
}

// SelfTestResult represents the result of a self-test run.
type SelfTestResult struct {
	Passed            bool              `json:"passed"`
	TotalIterations   int               `json:"total_iterations"`
	TotalOperations   int               `json:"total_operations"`
	OperationResults  []OpResult        `json:"operation_results"`
	DurationMs       int64             `json:"duration_ms"`
	FailureDetails    []FailureDetail   `json:"failure_details,omitempty"`
	PassCondition     string            `json:"pass_condition"`
	FailureCode       string            `json:"failure_code"`
}

// OpResult represents the result of a single operation test.
type OpResult struct {
	Name            string   `json:"name"`
	Iterations      int      `json:"iterations"`
	FirstHash       string   `json:"first_hash"`
	AllHashesMatch  bool     `json:"all_hashes_match"`
	UniqueHashCount int      `json:"unique_hash_count"`
}

// FailureDetail provides details about a test failure.
type FailureDetail struct {
	Operation   string   `json:"operation"`
	Trial       int      `json:"trial"`
	Expected    string   `json:"expected"`
	Actual      string   `json:"actual"`
	Description string   `json:"description"`
}

// LoadSelfTestFixture loads a self-test fixture from the fixtures directory.
func LoadSelfTestFixture(name string) (*SelfTestFixture, error) {
	// Try multiple paths to find the fixture
	paths := []string{
		filepath.Join("fixtures", name+".fixture.json"),
		filepath.Join("fixtures", name+".json"),
		filepath.Join(".", "fixtures", name+".fixture.json"),
	}

	var lastErr error
	for _, p := range paths {
		b, err := os.ReadFile(p)
		if err == nil {
			var f SelfTestFixture
			if err := json.Unmarshal(b, &f); err == nil {
				return &f, nil
			}
			lastErr = err
		} else {
			lastErr = err
		}
	}

	return nil, fmt.Errorf("failed to load fixture %s: %w", name, lastErr)
}

// RunSelfTest executes the self-test with the specified number of iterations.
func RunSelfTest(fixture *SelfTestFixture, iterations int) *SelfTestResult {
	start := time.Now()
	result := &SelfTestResult{
		Passed:          true,
		TotalIterations: iterations,
		TotalOperations: len(fixture.Operations),
		PassCondition:   fixture.PassCondition,
		FailureCode:     fixture.FailureCode,
	}

	for _, op := range fixture.Operations {
		opResult := runOperationTest(op, iterations)
		result.OperationResults = append(result.OperationResults, opResult)

		if !opResult.AllHashesMatch {
			result.Passed = false
			result.FailureDetails = append(result.FailureDetails, FailureDetail{
				Operation:   op.Name,
				Description: fmt.Sprintf("Hash mismatch: expected %s but got different hash at some iteration", opResult.FirstHash),
			})
		}
	}

	result.DurationMs = time.Since(start).Milliseconds()
	return result
}

// runOperationTest runs a single operation test for the specified number of iterations.
func runOperationTest(op SelfTestOp, iterations int) OpResult {
	result := OpResult{
		Name:       op.Name,
		Iterations: iterations,
	}

	hashes := make(map[string]int)

	for i := 0; i < iterations; i++ {
		hash := Hash(op.Input)
		hashes[hash]++
	}

	// Get all unique hashes
	uniqueHashes := make([]string, 0, len(hashes))
	for h := range hashes {
		uniqueHashes = append(uniqueHashes, h)
	}
	sort.Strings(uniqueHashes)

	result.UniqueHashCount = len(uniqueHashes)
	result.AllHashesMatch = len(uniqueHashes) == 1

	if len(uniqueHashes) > 0 {
		result.FirstHash = uniqueHashes[0]
	}

	return result
}

// SelfTestRunner provides a configurable self-test runner.
type SelfTestRunner struct {
	Iterations int
	Fixtures   []string
	Verbose    bool
}

// NewSelfTestRunner creates a new self-test runner with default settings.
func NewSelfTestRunner() *SelfTestRunner {
	return &SelfTestRunner{
		Iterations: 200,
		Fixtures:   []string{"self_test", "tie_break", "fixed_point"},
		Verbose:    false,
	}
}

// Run executes all self-test fixtures.
func (r *SelfTestRunner) Run() *SelfTestResult {
	allPassed := true
	totalOps := 0
	totalIters := r.Iterations * len(r.Fixtures)
	var allResults []OpResult
	var failures []FailureDetail

	for _, fixtureName := range r.Fixtures {
		fixture, err := LoadSelfTestFixture(fixtureName)
		if err != nil {
			failures = append(failures, FailureDetail{
				Operation:   fixtureName,
				Description: fmt.Sprintf("Failed to load fixture: %v", err),
			})
			allPassed = false
			continue
		}

		result := RunSelfTest(fixture, r.Iterations)
		allResults = append(allResults, result.OperationResults...)
		totalOps += len(result.OperationResults)

		if !result.Passed {
			allPassed = false
			failures = append(failures, result.FailureDetails...)
		}

		if r.Verbose {
			fmt.Printf("Fixture %s: %v\n", fixtureName, result.Passed)
		}
	}

	return &SelfTestResult{
		Passed:           allPassed,
		TotalIterations:  totalIters,
		TotalOperations:  totalOps,
		OperationResults: allResults,
		FailureDetails:   failures,
	}
}

// FormatResult returns a human-readable string representation of the result.
func (r *SelfTestResult) FormatResult() string {
	status := "PASSED"
	if !r.Passed {
		status = "FAILED"
	}

	output := fmt.Sprintf("Self-Test Result: %s\n", status)
	output += fmt.Sprintf("Total Iterations: %d\n", r.TotalIterations)
	output += fmt.Sprintf("Total Operations: %d\n", r.TotalOperations)
	output += fmt.Sprintf("Duration: %dms\n\n", r.DurationMs)

	if len(r.FailureDetails) > 0 {
		output += "Failures:\n"
		for _, f := range r.FailureDetails {
			output += fmt.Sprintf("  - %s: %s\n", f.Operation, f.Description)
			if f.Trial > 0 {
				output += fmt.Sprintf("    Trial: %d\n", f.Trial)
			}
			if f.Expected != "" {
				output += fmt.Sprintf("    Expected: %s\n", f.Expected)
			}
			if f.Actual != "" {
				output += fmt.Sprintf("    Actual: %s\n", f.Actual)
			}
		}
	}

	return output
}

// SelfTestFromCode runs a deterministic self-test directly from code inputs.
// This is useful for CI gates that need to verify determinism programmatically.
func SelfTestFromCode(trial func() (string, error), iterations int) (string, error) {
	if iterations < 2 {
		return "", fmt.Errorf("self-test requires at least 2 iterations, got %d", iterations)
	}

	var firstHash string
	for i := 0; i < iterations; i++ {
		hash, err := trial()
		if err != nil {
			return "", fmt.Errorf("iteration %d failed: %w", i, err)
		}

		if firstHash == "" {
			firstHash = hash
		} else if firstHash != hash {
			return firstHash, fmt.Errorf("nondeterminism detected at iteration %d: hash mismatch (expected: %s, got: %s)", i, firstHash, hash)
		}
	}

	return firstHash, nil
}
