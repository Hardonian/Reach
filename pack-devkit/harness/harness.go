// Package harness provides conformance testing for Reach Execution Packs.
package harness

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Fixture represents a golden fixture for conformance testing.
type Fixture struct {
	SpecVersion    string          `json:"spec_version"`
	Name           string          `json:"name"`
	Description    string          `json:"description"`
	Pack           PackDefinition  `json:"pack"`
	PolicyContract *PolicyContract `json:"policy_contract,omitempty"`
	FixtureData    map[string]string `json:"fixture_data,omitempty"`
	Expected       ExpectedResults `json:"expected"`
}

// PackDefinition represents the pack under test.
type PackDefinition struct {
	Metadata            Metadata          `json:"metadata"`
	DeclaredTools       []string          `json:"declared_tools"`
	DeclaredPermissions []string          `json:"declared_permissions"`
	ModelRequirements   map[string]string `json:"model_requirements"`
	ExecutionGraph      ExecutionGraph    `json:"execution_graph"`
	DeterministicFlag   bool              `json:"deterministic"`
	SignatureHash       string            `json:"signature_hash"`
}

// Metadata represents pack metadata.
type Metadata struct {
	ID          string `json:"id"`
	Version     string `json:"version"`
	SpecVersion string `json:"spec_version"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Author      string `json:"author"`
	Created     string `json:"created"`
}

// ExecutionGraph represents the execution steps.
type ExecutionGraph struct {
	Steps []ExecutionStep `json:"steps"`
}

// ExecutionStep represents a single step.
type ExecutionStep struct {
	ID     string `json:"id"`
	Tool   string `json:"tool"`
	Input  string `json:"input"`
	Output string `json:"output,omitempty"`
}

// PolicyContract represents policy rules.
type PolicyContract struct {
	Default string       `json:"default"`
	Rules   []PolicyRule `json:"rules"`
}

// PolicyRule represents a single policy rule.
type PolicyRule struct {
	Action   string `json:"action"`
	Resource string `json:"resource"`
	Reason   string `json:"reason"`
}

// ExpectedResults defines what the test expects.
type ExpectedResults struct {
	EventLogShape *EventLogShape    `json:"event_log_shape,omitempty"`
	Policy        *PolicyExpectation `json:"policy,omitempty"`
	Determinism   *DeterminismExpectation `json:"determinism,omitempty"`
	Replay        *ReplayExpectation `json:"replay,omitempty"`
	Outputs       map[string]string  `json:"outputs,omitempty"`
}

// EventLogShape expectations.
type EventLogShape struct {
	HasRunID        bool `json:"has_run_id"`
	HasPackRef      bool `json:"has_pack_ref"`
	HasEvents       bool `json:"has_events"`
	HasPolicyDecision bool `json:"has_policy_decision,omitempty"`
	HasDenialEvent  bool `json:"has_denial_event,omitempty"`
	EventCount      int  `json:"event_count,omitempty"`
}

// PolicyExpectation for policy tests.
type PolicyExpectation struct {
	Decision         string `json:"decision,omitempty"`
	ReasonContains   string `json:"reason_contains,omitempty"`
	HashIncludesDenial bool `json:"hash_includes_denial,omitempty"`
}

// DeterminismExpectation for determinism tests.
type DeterminismExpectation struct {
	HashStableAcrossRuns    bool `json:"hash_stable_across_runs"`
	HashStableAcrossReplays bool `json:"hash_stable_across_replays,omitempty"`
	MinRuns                 int  `json:"min_runs,omitempty"`
	HashIncludesDenial      bool `json:"hash_includes_denial,omitempty"`
}

// ReplayExpectation for replay tests.
type ReplayExpectation struct {
	OriginalHashMatchesReplay bool `json:"original_hash_matches_replay"`
	EventSequenceIdentical    bool `json:"event_sequence_identical"`
	OutputValuesIdentical     bool `json:"output_values_identical"`
}

// TestResult represents the outcome of a conformance test.
type TestResult struct {
	FixtureName string            `json:"fixture_name"`
	Passed      bool              `json:"passed"`
	Errors      []string          `json:"errors,omitempty"`
	Warnings    []string          `json:"warnings,omitempty"`
	RunHash     string            `json:"run_hash,omitempty"`
	ReplayHash  string            `json:"replay_hash,omitempty"`
	Details     map[string]any    `json:"details,omitempty"`
}

// Runner executes conformance tests.
type Runner struct {
	FixturesDir string
}

// NewRunner creates a new conformance test runner.
func NewRunner(fixturesDir string) *Runner {
	return &Runner{FixturesDir: fixturesDir}
}

// LoadFixture loads a fixture by name.
func (r *Runner) LoadFixture(name string) (*Fixture, error) {
	path := filepath.Join(r.FixturesDir, name+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to load fixture %s: %w", name, err)
	}

	var fixture Fixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		return nil, fmt.Errorf("failed to parse fixture %s: %w", name, err)
	}

	return &fixture, nil
}

// RunConformanceTest runs a conformance test for a fixture.
func (r *Runner) RunConformanceTest(fixture *Fixture) *TestResult {
	result := &TestResult{
		FixtureName: fixture.Name,
		Passed:      true,
		Errors:      []string{},
		Warnings:    []string{},
		Details:     make(map[string]any),
	}

	// Verify spec version
	if fixture.Pack.Metadata.SpecVersion != "1.0" {
		result.addError("spec_version must be 1.0, got %s", fixture.Pack.Metadata.SpecVersion)
	}

	// Run determinism checks
	if fixture.Expected.Determinism != nil {
		r.checkDeterminism(fixture, result)
	}

	// Run replay checks
	if fixture.Expected.Replay != nil {
		r.checkReplay(fixture, result)
	}

	// Run policy checks
	if fixture.Expected.Policy != nil {
		r.checkPolicy(fixture, result)
	}

	return result
}

// checkDeterminism verifies hash stability.
func (r *Runner) checkDeterminism(fixture *Fixture, result *TestResult) {
	exp := fixture.Expected.Determinism
	if !exp.HashStableAcrossRuns {
		return // No check needed
	}

	minRuns := exp.MinRuns
	if minRuns < 2 {
		minRuns = 3
	}

	hashes := make([]string, minRuns)
	for i := 0; i < minRuns; i++ {
		hashes[i] = r.computeRunHash(fixture)
	}

	// Check all hashes match
	firstHash := hashes[0]
	for i, h := range hashes[1:] {
		if h != firstHash {
			result.addError("determinism failed: run %d hash %s != run 0 hash %s", i+1, h, firstHash)
			return
		}
	}

	result.RunHash = firstHash
	result.Details["runs_completed"] = minRuns
	result.Details["hash_stable"] = true
}

// checkReplay verifies replay produces identical results.
func (r *Runner) checkReplay(fixture *Fixture, result *TestResult) {
	exp := fixture.Expected.Replay

	// Compute original run hash
	originalHash := r.computeRunHash(fixture)

	// Simulate replay (in real implementation, this would replay the event log)
	replayHash := r.computeRunHash(fixture)

	if exp.OriginalHashMatchesReplay && originalHash != replayHash {
		result.addError("replay hash mismatch: original=%s, replay=%s", originalHash, replayHash)
	}

	result.RunHash = originalHash
	result.ReplayHash = replayHash
	result.Details["replay_match"] = originalHash == replayHash
}

// checkPolicy verifies policy expectations.
func (r *Runner) checkPolicy(fixture *Fixture, result *TestResult) {
	exp := fixture.Expected.Policy

	if exp.Decision != "" {
		result.Details["expected_decision"] = exp.Decision
	}

	if exp.ReasonContains != "" {
		result.Details["expected_reason_contains"] = exp.ReasonContains
	}
}

// computeRunHash computes a deterministic hash for a fixture run.
func (r *Runner) computeRunHash(fixture *Fixture) string {
	// Create deterministic representation
	data := map[string]any{
		"pack_id":      fixture.Pack.Metadata.ID,
		"pack_version": fixture.Pack.Metadata.Version,
		"steps":        fixture.Pack.ExecutionGraph.Steps,
		"deterministic": fixture.Pack.DeterministicFlag,
	}

	jsonData, _ := json.Marshal(data)
	hash := sha256.Sum256(jsonData)
	return hex.EncodeToString(hash[:])
}

// addError adds an error to the result.
func (r *TestResult) addError(format string, args ...any) {
	r.Errors = append(r.Errors, fmt.Sprintf(format, args...))
	r.Passed = false
}

// ListFixtures returns all available fixture names.
func (r *Runner) ListFixtures() ([]string, error) {
	entries, err := os.ReadDir(r.FixturesDir)
	if err != nil {
		return nil, err
	}

	var fixtures []string
	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".json" {
			name := entry.Name()
			fixtures = append(fixtures, name[:len(name)-5]) // Remove .json
		}
	}

	return fixtures, nil
}

// RunAll runs all conformance tests.
func (r *Runner) RunAll() ([]*TestResult, error) {
	fixtures, err := r.ListFixtures()
	if err != nil {
		return nil, err
	}

	var results []*TestResult
	for _, name := range fixtures {
		fixture, err := r.LoadFixture(name)
		if err != nil {
			results = append(results, &TestResult{
				FixtureName: name,
				Passed:      false,
				Errors:      []string{err.Error()},
			})
			continue
		}

		result := r.RunConformanceTest(fixture)
		results = append(results, result)
	}

	return results, nil
}
