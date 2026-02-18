package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestDefault(t *testing.T) {
	cfg := Default()

	if cfg == nil {
		t.Fatal("Default() returned nil")
	}

	// Check some defaults
	if cfg.Execution.MaxConcurrentRuns != 10 {
		t.Errorf("expected MaxConcurrentRuns=10, got: %d", cfg.Execution.MaxConcurrentRuns)
	}
	if cfg.Federation.MaxDelegationRetries != 3 {
		t.Errorf("expected MaxDelegationRetries=3, got: %d", cfg.Federation.MaxDelegationRetries)
	}
	if cfg.Policy.Mode != "enforce" {
		t.Errorf("expected Policy.Mode='enforce', got: %s", cfg.Policy.Mode)
	}
}

func TestLoadFromFile(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")

	configContent := `{
		"execution": {
			"max_concurrent_runs": 20,
			"sandbox_enabled": false
		},
		"policy": {
			"mode": "warn"
		}
	}`

	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("failed to write config file: %v", err)
	}

	cfg, err := LoadFromFile(configPath)
	if err != nil {
		t.Fatalf("LoadFromFile failed: %v", err)
	}

	if cfg.Execution.MaxConcurrentRuns != 20 {
		t.Errorf("expected MaxConcurrentRuns=20, got: %d", cfg.Execution.MaxConcurrentRuns)
	}
	if cfg.Execution.SandboxEnabled != false {
		t.Errorf("expected SandboxEnabled=false, got: %v", cfg.Execution.SandboxEnabled)
	}
	if cfg.Policy.Mode != "warn" {
		t.Errorf("expected Policy.Mode='warn', got: %s", cfg.Policy.Mode)
	}
	// Check default is preserved for unspecified fields
	if cfg.Federation.MaxDelegationRetries != 3 {
		t.Errorf("expected MaxDelegationRetries=3 (default), got: %d", cfg.Federation.MaxDelegationRetries)
	}
}

func TestLoadFromEnv(t *testing.T) {
	// Set environment variables
	os.Setenv("REACH_MAX_CONCURRENT_RUNS", "25")
	os.Setenv("REACH_POLICY_MODE", "warn")
	os.Setenv("REACH_FEDERATION_ENABLED", "false")
	os.Setenv("REACH_EXECUTION_TIMEOUT", "10m")
	defer func() {
		os.Unsetenv("REACH_MAX_CONCURRENT_RUNS")
		os.Unsetenv("REACH_POLICY_MODE")
		os.Unsetenv("REACH_FEDERATION_ENABLED")
		os.Unsetenv("REACH_EXECUTION_TIMEOUT")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if cfg.Execution.MaxConcurrentRuns != 25 {
		t.Errorf("expected MaxConcurrentRuns=25, got: %d", cfg.Execution.MaxConcurrentRuns)
	}
	if cfg.Policy.Mode != "warn" {
		t.Errorf("expected Policy.Mode='warn', got: %s", cfg.Policy.Mode)
	}
	if cfg.Federation.Enabled != false {
		t.Errorf("expected Federation.Enabled=false, got: %v", cfg.Federation.Enabled)
	}
	if cfg.Execution.ExecutionTimeout != 10*time.Minute {
		t.Errorf("expected ExecutionTimeout=10m, got: %v", cfg.Execution.ExecutionTimeout)
	}
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name    string
		config  func() *Config
		valid   bool
		errors  int
	}{
		{
			name: "valid default config",
			config: func() *Config {
				return Default()
			},
			valid: true,
		},
		{
			name: "negative concurrent runs",
			config: func() *Config {
				cfg := Default()
				cfg.Execution.MaxConcurrentRuns = -1
				return cfg
			},
			valid:  false,
			errors: 1,
		},
		{
			name: "invalid event log mode",
			config: func() *Config {
				cfg := Default()
				cfg.Execution.EventLogMode = "invalid"
				return cfg
			},
			valid:  false,
			errors: 1,
		},
		{
			name: "invalid policy mode",
			config: func() *Config {
				cfg := Default()
				cfg.Policy.Mode = "invalid"
				return cfg
			},
			valid:  false,
			errors: 1,
		},
		{
			name: "empty registry url",
			config: func() *Config {
				cfg := Default()
				cfg.Registry.URL = ""
				return cfg
			},
			valid:  false,
			errors: 1,
		},
		{
			name: "invalid registry url",
			config: func() *Config {
				cfg := Default()
				cfg.Registry.URL = "ftp://invalid"
				return cfg
			},
			valid:  false,
			errors: 1,
		},
		{
			name: "invalid log level",
			config: func() *Config {
				cfg := Default()
				cfg.Telemetry.LogLevel = "invalid"
				return cfg
			},
			valid:  false,
			errors: 1,
		},
		{
			name: "retry max less than base",
			config: func() *Config {
				cfg := Default()
				cfg.Federation.DelegationRetryBaseMs = 1000
				cfg.Federation.DelegationRetryMaxMs = 100
				return cfg
			},
			valid:  false,
			errors: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := tt.config()
			result := cfg.Validate()

			if tt.valid && !result.Valid() {
				t.Errorf("expected valid config, got errors: %s", result.Error())
			}
			if !tt.valid && result.Valid() {
				t.Error("expected invalid config, but validation passed")
			}
			if !tt.valid && len(result.Errors) != tt.errors {
				t.Errorf("expected %d errors, got: %d (%s)", tt.errors, len(result.Errors), result.Error())
			}
		})
	}
}

func TestValidateWithDefaults(t *testing.T) {
	cfg := &Config{
		Execution: ExecutionConfig{
			// Leave most fields as zero values
		},
	}

	err := cfg.ValidateWithDefaults()
	if err != nil {
		t.Fatalf("ValidateWithDefaults failed: %v", err)
	}

	// Check defaults were applied
	if cfg.Execution.MaxConcurrentRuns != 10 {
		t.Errorf("expected MaxConcurrentRuns=10 (default), got: %d", cfg.Execution.MaxConcurrentRuns)
	}
}

func TestSave(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")

	cfg := Default()
	cfg.Execution.MaxConcurrentRuns = 50

	if err := Save(cfg, configPath); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Load it back
	loaded, err := LoadFromFile(configPath)
	if err != nil {
		t.Fatalf("LoadFromFile failed: %v", err)
	}

	if loaded.Execution.MaxConcurrentRuns != 50 {
		t.Errorf("expected MaxConcurrentRuns=50, got: %d", loaded.Execution.MaxConcurrentRuns)
	}
}

func TestGetEnvDocs(t *testing.T) {
	docs := GetEnvDocs()
	if len(docs) == 0 {
		t.Error("expected some environment variable documentation")
	}

	// Check some expected variables
	if _, ok := docs["REACH_MAX_CONCURRENT_RUNS"]; !ok {
		t.Error("expected REACH_MAX_CONCURRENT_RUNS in docs")
	}
	if _, ok := docs["REACH_LOG_LEVEL"]; !ok {
		t.Error("expected REACH_LOG_LEVEL in docs")
	}
}

func TestValidationResult(t *testing.T) {
	result := &ValidationResult{
		Errors: []*ValidationError{
			{Field: "test", Message: "error 1"},
			{Field: "test2", Message: "error 2"},
		},
	}

	if result.Valid() {
		t.Error("result with errors should not be valid")
	}

	errStr := result.Error()
	if errStr == "" {
		t.Error("Error() should return non-empty string for invalid result")
	}
	if !contains(errStr, "error 1") || !contains(errStr, "error 2") {
		t.Error("Error() should include all error messages")
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
