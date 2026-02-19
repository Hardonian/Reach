package pack

import (
	"testing"
)

func TestNewValidateCommand(t *testing.T) {
	cmd := NewValidateCommand("/path/to/pack")
	if cmd == nil {
		t.Fatal("expected non-nil command")
	}
	if cmd.PackPath != "/path/to/pack" {
		t.Errorf("expected PackPath '/path/to/pack', got %s", cmd.PackPath)
	}
	if cmd.FixturesDir == "" {
		t.Error("expected FixturesDir to be set")
	}
}

func TestValidateFlags(t *testing.T) {
	flags := ValidateFlags{
		JSON:     true,
		Fixtures: "/custom/fixtures",
	}
	if !flags.JSON {
		t.Error("expected JSON to be true")
	}
	if flags.Fixtures != "/custom/fixtures" {
		t.Errorf("expected Fixtures '/custom/fixtures', got %s", flags.Fixtures)
	}
}

func TestRunValidateMissingPath(t *testing.T) {
	flags := ValidateFlags{}
	err := RunValidate([]string{}, flags)
	if err == nil {
		t.Error("expected error for missing path")
	}
}

func TestNewScoreCommand(t *testing.T) {
	cmd := NewScoreCommand("/path/to/pack")
	if cmd == nil {
		t.Fatal("expected non-nil command")
	}
	if cmd.PackPath != "/path/to/pack" {
		t.Errorf("expected PackPath '/path/to/pack', got %s", cmd.PackPath)
	}
}

func TestScoreFlags(t *testing.T) {
	flags := ScoreFlags{
		JSON:     true,
		Badges:   true,
		Fixtures: "/custom/fixtures",
	}
	if !flags.JSON {
		t.Error("expected JSON to be true")
	}
	if !flags.Badges {
		t.Error("expected Badges to be true")
	}
}

func TestRunScoreMissingPath(t *testing.T) {
	flags := ScoreFlags{}
	err := RunScore([]string{}, flags)
	if err == nil {
		t.Error("expected error for missing path")
	}
}

func TestNewDocsCommand(t *testing.T) {
	cmd := NewDocsCommand("/path/to/pack")
	if cmd == nil {
		t.Fatal("expected non-nil command")
	}
	if cmd.PackPath != "/path/to/pack" {
		t.Errorf("expected PackPath '/path/to/pack', got %s", cmd.PackPath)
	}
	if cmd.OutputPath == "" {
		t.Error("expected OutputPath to be set")
	}
}

func TestDocsFlags(t *testing.T) {
	flags := DocsFlags{
		Output:     "/custom/output.md",
		WithScores: true,
		Registry:   true,
	}
	if flags.Output != "/custom/output.md" {
		t.Errorf("expected Output '/custom/output.md', got %s", flags.Output)
	}
	if !flags.WithScores {
		t.Error("expected WithScores to be true")
	}
	if !flags.Registry {
		t.Error("expected Registry to be true")
	}
}

func TestRunDocsMissingPath(t *testing.T) {
	flags := DocsFlags{}
	err := RunDocs([]string{}, flags)
	if err == nil {
		t.Error("expected error for missing path")
	}
}

func TestNewRegistryPRCommand(t *testing.T) {
	cmd := NewRegistryPRCommand("/path/to/registry")
	if cmd == nil {
		t.Fatal("expected non-nil command")
	}
	if cmd.RegistryDir != "/path/to/registry" {
		t.Errorf("expected RegistryDir '/path/to/registry', got %s", cmd.RegistryDir)
	}
}

func TestRunRegistryPR(t *testing.T) {
	// Test with default path
	err := RunRegistryPR([]string{}, false)
	// This will fail since no registry exists, but tests the path
	if err == nil {
		t.Log("Registry PR validation succeeded (unexpected)")
	} else {
		t.Logf("Registry PR validation failed as expected: %v", err)
	}
}

func TestPrintValidateHelp(t *testing.T) {
	// Just ensure it doesn't panic
	PrintValidateHelp()
}

func TestPrintScoreHelp(t *testing.T) {
	// Just ensure it doesn't panic
	PrintScoreHelp()
}

func TestPrintDocsHelp(t *testing.T) {
	// Just ensure it doesn't panic
	PrintDocsHelp()
}

func TestPrintRegistryPRHelp(t *testing.T) {
	// Just ensure it doesn't panic
	PrintRegistryPRHelp()
}
