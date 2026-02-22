package determinism

import (
	"encoding/json"
	"fmt"
	"os"
)

// StressFixture represents a loaded .stress.json file.
type StressFixture struct {
	FixtureVersion  string           `json:"fixture_version"`
	StressType      string           `json:"stress_type"`
	Description     string           `json:"description"`
	BaseRunID       string           `json:"base_run_id"`
	BaseFingerprint string           `json:"base_fingerprint"`
	Mutations       []StressMutation `json:"mutations"`
	PassCondition   string           `json:"pass_condition"`
	FailureCode     string           `json:"failure_code"`
}

// StressMutation is a single trial within a fixture.
type StressMutation struct {
	Trial               int            `json:"trial"`
	Description         string         `json:"description"`
	Inputs              map[string]any `json:"inputs"`
	ExpectedFingerprint string         `json:"expected_fingerprint"`
}

// LoadStressFixture reads a fixture from disk.
func LoadStressFixture(path string) (*StressFixture, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read fixture: %w", err)
	}

	var f StressFixture
	if err := json.Unmarshal(b, &f); err != nil {
		return nil, fmt.Errorf("failed to unmarshal fixture: %w", err)
	}

	return &f, nil
}

// RunStressTrial simulates an engine run with the given inputs and returns the hash.
// In a real scenario, this would call the actual engine.
// For the determinism module's own tests, we're testing the hashing of the inputs.
func RunStressTrial(mutation StressMutation) string {
	// For this module, we're verifying that the Hash function is stable
	// across different input representations that are semantically identical.
	return Hash(mutation.Inputs)
}
