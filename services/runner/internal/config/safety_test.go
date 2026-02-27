package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSafetyConfigDefaults(t *testing.T) {
	cfg := Default()

	// Production mode should default to true
	if cfg.Safety.ProductionMode != true {
		t.Errorf("expected ProductionMode=true by default, got: %v", cfg.Safety.ProductionMode)
	}

	// RequiemBinPath should default to empty
	if cfg.Safety.RequiemBinPath != "" {
		t.Errorf("expected RequiemBinPath='' by default, got: %s", cfg.Safety.RequiemBinPath)
	}
}

func TestProductionModeEnvOverride(t *testing.T) {
	// Test REACH_DEBUG disables production mode
	os.Setenv("REACH_DEBUG", "1")
	defer os.Unsetenv("REACH_DEBUG")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() failed: %v", err)
	}

	if cfg.Safety.ProductionMode != false {
		t.Errorf("expected ProductionMode=false when REACH_DEBUG is set, got: %v", cfg.Safety.ProductionMode)
	}
}

func TestProductionModeExplicitDisable(t *testing.T) {
	// Test REACH_PRODUCTION=false disables production mode
	os.Setenv("REACH_PRODUCTION", "false")
	defer os.Unsetenv("REACH_PRODUCTION")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() failed: %v", err)
	}

	if cfg.Safety.ProductionMode != false {
		t.Errorf("expected ProductionMode=false when REACH_PRODUCTION=false, got: %v", cfg.Safety.ProductionMode)
	}
}

func TestProductionModeExplicitEnable(t *testing.T) {
	// Test REACH_PRODUCTION=true enables production mode
	os.Setenv("REACH_PRODUCTION", "true")
	defer os.Unsetenv("REACH_PRODUCTION")

	// Also set REACH_DEBUG to verify REACH_PRODUCTION takes precedence over REACH_DEBUG
	os.Setenv("REACH_DEBUG", "1")
	defer os.Unsetenv("REACH_DEBUG")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() failed: %v", err)
	}

	// REACH_PRODUCTION=true should override REACH_DEBUG
	if cfg.Safety.ProductionMode != true {
		t.Errorf("expected ProductionMode=true when REACH_PRODUCTION=true (even with REACH_DEBUG set), got: %v", cfg.Safety.ProductionMode)
	}
}

func TestRequiemBinPathEmpty(t *testing.T) {
	// Empty path should return no warnings or errors
	warnings, err := ValidateRequiemBin("")
	if err != nil {
		t.Errorf("ValidateRequiemBin('') returned error: %v", err)
	}
	if len(warnings) != 0 {
		t.Errorf("ValidateRequiemBin('') returned warnings: %v", warnings)
	}
}

func TestRequiemBinPathNonExistent(t *testing.T) {
	// Non-existent path should return error
	warnings, err := ValidateRequiemBin("/nonexistent/path/to/requiem")
	if err == nil {
		t.Error("ValidateRequiemBin('/nonexistent/path') expected error, got nil")
	}
	if len(warnings) != 0 {
		t.Errorf("ValidateRequiemBin should not return warnings for non-existent path, got: %v", warnings)
	}
}

func TestRequiemBinPathNonAbsolute(t *testing.T) {
	// Create a temporary file to test non-absolute path warning
	tmpFile := filepath.Join(os.TempDir(), "test-requiem")
	if err := os.WriteFile(tmpFile, []byte("test"), 0644); err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile)

	// Non-absolute path should return warning but not error
	relativePath := "relative/path/to/requiem"
	warnings, err := ValidateRequiemBin(relativePath)
	if err != nil {
		t.Errorf("ValidateRequiemBin('%s') returned unexpected error: %v", relativePath, err)
	}
	if len(warnings) == 0 {
		t.Errorf("ValidateRequiemBin('%s') expected warning for non-absolute path", relativePath)
	}
}

func TestRequiemBinPathExecutable(t *testing.T) {
	// Create a temporary executable file
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "requiem")
	if err := os.WriteFile(tmpFile, []byte("#!/bin/bash\necho test"), 0755); err != nil {
		t.Fatalf("failed to create temp executable: %v", err)
	}

	// Absolute path to executable should return no warnings or errors
	warnings, err := ValidateRequiemBin(tmpFile)
	if err != nil {
		t.Errorf("ValidateRequiemBin('%s') returned unexpected error: %v", tmpFile, err)
	}
	if len(warnings) != 0 {
		t.Errorf("ValidateRequiemBin('%s') expected no warnings for valid executable, got: %v", tmpFile, warnings)
	}
}

func TestRequiemBinPathNonExecutable(t *testing.T) {
	// Create a temporary non-executable file
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "requiem-noexec")
	if err := os.WriteFile(tmpFile, []byte("test content"), 0644); err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}

	// Non-executable file should return warning but not error
	warnings, err := ValidateRequiemBin(tmpFile)
	if err != nil {
		t.Errorf("ValidateRequiemBin('%s') returned unexpected error: %v", tmpFile, err)
	}
	if len(warnings) == 0 {
		t.Errorf("ValidateRequiemBin('%s') expected warning for non-executable file", tmpFile)
	}
}

func TestRequiemBinPathDirectory(t *testing.T) {
	// A directory should return error (not a regular file)
	tmpDir := t.TempDir()

	warnings, err := ValidateRequiemBin(tmpDir)
	if err == nil {
		t.Error("ValidateRequiemBin(directory) expected error for directory, got nil")
	}
	if len(warnings) != 0 {
		t.Errorf("ValidateRequiemBin(directory) expected no warnings, got: %v", warnings)
	}
}

func TestSafetyConfigFromFile(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")

	configContent := `{
		"safety": {
			"production_mode": false,
			"requiem_bin_path": "/custom/path/requiem"
		}
	}`

	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("failed to write config file: %v", err)
	}

	cfg, err := LoadFromFile(configPath)
	if err != nil {
		t.Fatalf("LoadFromFile failed: %v", err)
	}

	if cfg.Safety.ProductionMode != false {
		t.Errorf("expected ProductionMode=false from file, got: %v", cfg.Safety.ProductionMode)
	}
	if cfg.Safety.RequiemBinPath != "/custom/path/requiem" {
		t.Errorf("expected RequiemBinPath='/custom/path/requiem' from file, got: %s", cfg.Safety.RequiemBinPath)
	}
}
