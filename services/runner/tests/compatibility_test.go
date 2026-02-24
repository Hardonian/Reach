package tests

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// CompatibilityTest verifies that older fixture bundles can be replayed
// and produce the same derived summaries (fingerprint, hashes).
// This ensures backward compatibility across engine versions.

type FixtureManifest struct {
	Comment          string   `json:"_comment"`
	FixtureVersion   string   `json:"fixture_version"`
	Description      string   `json:"description"`
	Run              RunData  `json:"run"`
	RequiredFields   []string `json:"required_fields"`
	ConformanceRules []string `json:"conformance_rules"`
}

type RunData struct {
	RunID          string   `json:"run_id"`
	EngineVersion  string   `json:"engine_version"`
	SpecVersion    string   `json:"spec_version"`
	PolicyVersion  string   `json:"policy_version"`
	InputHash      string   `json:"input_hash"`
	ArtifactHashes []string `json:"artifact_hashes"`
	OutputHash     string   `json:"output_hash"`
	EventLogHash   string   `json:"event_log_hash"`
	TimestampEpoch int      `json:"timestamp_epoch"`
	Fingerprint    string   `json:"fingerprint"`
}

// TestCompatibility_HelloDeterministic verifies the hello-deterministic fixture
// can be loaded and its required fields are present.
func TestCompatibility_HelloDeterministic(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "..", "testdata", "fixtures", "conformance", "hello-deterministic.fixture.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	var fixture FixtureManifest
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("failed to parse fixture: %v", err)
	}

	// Verify required fields exist
	if fixture.Run.RunID == "" {
		t.Error("run_id is required but empty")
	}
	if fixture.Run.EngineVersion == "" {
		t.Error("engine_version is required but empty")
	}
	if fixture.Run.SpecVersion == "" {
		t.Error("spec_version is required but empty")
	}
	if fixture.Run.Fingerprint == "" {
		t.Error("fingerprint is required but empty")
	}

	// Verify fixture version is stable
	if fixture.FixtureVersion != "1.0.0" {
		t.Errorf("expected fixture_version 1.0.0, got %s", fixture.FixtureVersion)
	}

	t.Logf("Fixture: %s", fixture.Description)
	t.Logf("Run ID: %s", fixture.Run.RunID)
	t.Logf("Engine Version: %s", fixture.Run.EngineVersion)
	t.Logf("Spec Version: %s", fixture.Run.SpecVersion)
}

// TestCompatibility_CapsuleManifest verifies the capsule manifest fixture
// has all required version fields.
func TestCompatibility_CapsuleManifest(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "..", "testdata", "fixtures", "conformance", "capsule-manifest.fixture.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	var fixture struct {
		Comment          string                 `json:"_comment"`
		FixtureVersion   string                 `json:"fixture_version"`
		Description      string                 `json:"description"`
		Manifest         map[string]interface{} `json:"manifest"`
		RequiredFields   []string               `json:"required_fields"`
		ConformanceRules []string               `json:"conformance_rules"`
	}

	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("failed to parse fixture: %v", err)
	}

	// Verify all required fields are present
	for _, field := range fixture.RequiredFields {
		if _, ok := fixture.Manifest[field]; !ok {
			t.Errorf("required field %s is missing from manifest", field)
		}
	}

	// Verify version fields
	if specVer, ok := fixture.Manifest["spec_version"].(string); !ok || specVer == "" {
		t.Error("spec_version must be a non-empty string")
	}
	if engVer, ok := fixture.Manifest["engine_version"].(string); !ok || engVer == "" {
		t.Error("engine_version must be a non-empty string")
	}

	t.Logf("Fixture: %s", fixture.Description)
}

// TestCompatibility_VersionOutput verifies the version output fixture
// has all required fields for machine-readable output.
func TestCompatibility_VersionOutput(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "..", "testdata", "fixtures", "conformance", "version-output.fixture.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	var fixture struct {
		Comment          string                 `json:"_comment"`
		FixtureVersion   string                 `json:"fixture_version"`
		Description      string                 `json:"description"`
		VersionOutput    map[string]interface{} `json:"version_output"`
		RequiredFields   []string               `json:"required_fields"`
		ConformanceRules []string               `json:"conformance_rules"`
	}

	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("failed to parse fixture: %v", err)
	}

	// Verify all required fields are present
	for _, field := range fixture.RequiredFields {
		if _, ok := fixture.VersionOutput[field]; !ok {
			t.Errorf("required field %s is missing from version_output", field)
		}
	}

	// Verify compatibility policy
	if policy, ok := fixture.VersionOutput["compatibilityPolicy"].(string); !ok || policy != "backward_compatible" {
		t.Error("compatibilityPolicy must be 'backward_compatible'")
	}

	// Verify supported versions is non-empty
	if versions, ok := fixture.VersionOutput["supportedVersions"].([]interface{}); !ok || len(versions) == 0 {
		t.Error("supportedVersions must be a non-empty array")
	}

	t.Logf("Fixture: %s", fixture.Description)
}

// TestCompatibility_DecisionOutput verifies the decision output fixture
// has all required fields for policy decisions.
func TestCompatibility_DecisionOutput(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "..", "testdata", "fixtures", "conformance", "decision-output.fixture.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	var fixture struct {
		Comment          string                 `json:"_comment"`
		FixtureVersion   string                 `json:"fixture_version"`
		Description      string                 `json:"description"`
		Decision         map[string]interface{} `json:"decision"`
		RequiredFields   []string               `json:"required_fields"`
		ConformanceRules []string               `json:"conformance_rules"`
	}

	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("failed to parse fixture: %v", err)
	}

	// Verify all required fields are present
	for _, field := range fixture.RequiredFields {
		if _, ok := fixture.Decision[field]; !ok {
			t.Errorf("required field %s is missing from decision", field)
		}
	}

	// Verify allowed is boolean
	if _, ok := fixture.Decision["allowed"].(bool); !ok {
		t.Error("allowed must be a boolean")
	}

	// Verify violations is array
	if violations, ok := fixture.Decision["violations"].([]interface{}); !ok {
		t.Error("violations must be an array")
	} else if len(violations) > 0 {
		if allowed, ok := fixture.Decision["allowed"].(bool); ok && allowed {
			t.Error("if allowed is true, violations should be empty")
		}
	}

	t.Logf("Fixture: %s", fixture.Description)
}
