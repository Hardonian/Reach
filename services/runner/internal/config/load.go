package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"time"
)

// Load loads configuration from defaults, file, and environment.
// Resolution order (highest priority last):
// 1. Defaults
// 2. Config file
// 3. Environment variables
func Load() (*Config, error) {
	cfg := Default()

	// Load from config file if present
	if path := configFilePath(); path != "" {
		if err := loadFromFile(cfg, path); err != nil && !os.IsNotExist(err) {
			return nil, fmt.Errorf("loading config file: %w", err)
		}
	}

	// Load from environment (overrides file)
	if err := loadFromEnv(cfg); err != nil {
		return nil, fmt.Errorf("loading environment: %w", err)
	}

	return cfg, nil
}

// LoadFromFile loads configuration from a specific file.
func LoadFromFile(path string) (*Config, error) {
	cfg := Default()
	if err := loadFromFile(cfg, path); err != nil {
		return nil, err
	}
	return cfg, nil
}

// loadFromFile loads configuration from a JSON file.
func loadFromFile(cfg *Config, path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, cfg)
}

// loadFromEnv loads configuration from environment variables.
func loadFromEnv(cfg *Config) error {
	return loadStructFromEnv(reflect.ValueOf(cfg).Elem(), "")
}

// loadStructFromEnv recursively loads struct fields from environment.
func loadStructFromEnv(v reflect.Value, prefix string) error {
	t := v.Type()

	for i := 0; i < v.NumField(); i++ {
		field := v.Field(i)
		fieldType := t.Field(i)

		// Skip unexported fields
		if !field.CanSet() {
			continue
		}

		envTag := fieldType.Tag.Get("env")
		if envTag == "" {
			// No env tag, check if it's a nested struct
			if field.Kind() == reflect.Struct {
				if err := loadStructFromEnv(field, prefix); err != nil {
					return err
				}
			}
			continue
		}

		// Check environment variable
		if value := os.Getenv(envTag); value != "" {
			if err := setField(field, value); err != nil {
				return fmt.Errorf("setting %s: %w", envTag, err)
			}
		}
	}

	return nil
}

// setField sets a struct field from a string value.
func setField(field reflect.Value, value string) error {
	switch field.Kind() {
	case reflect.String:
		field.SetString(value)
	case reflect.Int, reflect.Int64:
		if field.Type() == reflect.TypeOf(time.Duration(0)) {
			// Handle duration
			d, err := time.ParseDuration(value)
			if err != nil {
				return fmt.Errorf("parsing duration: %w", err)
			}
			field.Set(reflect.ValueOf(d))
		} else {
			// Handle int
			n, err := strconv.ParseInt(value, 10, 64)
			if err != nil {
				return fmt.Errorf("parsing int: %w", err)
			}
			field.SetInt(n)
		}
	case reflect.Int32:
		n, err := strconv.ParseInt(value, 10, 32)
		if err != nil {
			return fmt.Errorf("parsing int32: %w", err)
		}
		field.SetInt(n)
	case reflect.Bool:
		b, err := strconv.ParseBool(value)
		if err != nil {
			return fmt.Errorf("parsing bool: %w", err)
		}
		field.SetBool(b)
	case reflect.Float64:
		f, err := strconv.ParseFloat(value, 64)
		if err != nil {
			return fmt.Errorf("parsing float64: %w", err)
		}
		field.SetFloat(f)
	default:
		return fmt.Errorf("unsupported field type: %s", field.Kind())
	}
	return nil
}

// configFilePath returns the path to the config file.
func configFilePath() string {
	// Check environment override
	if path := os.Getenv("REACH_CONFIG_PATH"); path != "" {
		return path
	}

	// Check default locations
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}

	paths := []string{
		filepath.Join(home, ".reach", "config.json"),
		filepath.Join(home, ".reach.json"),
	}

	for _, path := range paths {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}

	return ""
}

// Save saves configuration to a file.
func Save(cfg *Config, path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("creating config directory: %w", err)
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling config: %w", err)
	}

	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("writing config file: %w", err)
	}

	return nil
}

// GetEnvDocs returns documentation for all environment variables.
func GetEnvDocs() map[string]string {
	return map[string]string{
		"REACH_MAX_CONCURRENT_RUNS":         "Maximum concurrent executions (default: 10)",
		"REACH_MAX_EVENT_BYTES":             "Maximum event log size in bytes (default: 104857600)",
		"REACH_EVENT_LOG_MODE":              "Event log overflow mode: warn or fail (default: warn)",
		"REACH_EXECUTION_TIMEOUT":           "Default execution timeout (default: 5m)",
		"REACH_SANDBOX_ENABLED":             "Enable sandboxing (default: true)",
		"REACH_FEDERATION_ENABLED":          "Enable federation (default: true)",
		"REACH_MAX_DELEGATION_RETRIES":      "Max delegation retries (default: 3)",
		"REACH_DELEGATION_RETRY_BASE_MS":    "Base retry delay in ms (default: 100)",
		"REACH_DELEGATION_RETRY_MAX_MS":     "Max retry delay in ms (default: 30000)",
		"REACH_CIRCUIT_BREAKER_THRESHOLD":   "Circuit breaker failure threshold (default: 5)",
		"REACH_CIRCUIT_BREAKER_TIMEOUT":     "Circuit breaker timeout (default: 30s)",
		"REACH_HANDSHAKE_TTL":               "Handshake challenge TTL (default: 5m)",
		"REACH_MAX_DELEGATION_LATENCY_MS":   "Max delegation latency in ms (default: 5000)",
		"REACH_POLICY_MODE":                 "Policy mode: enforce or warn (default: enforce)",
		"REACH_ALLOW_LEGACY_UNSIGNED_PACKS": "Allow legacy unsigned packs (default: false)",
		"REACH_REQUIRE_DETERMINISTIC":       "Require deterministic execution (default: false)",
		"REACH_POLICY_PATH":                 "Path to policy files",
		"REACH_REGISTRY_URL":                "Registry URL (default: https://registry.reach.dev)",
		"REACH_REGISTRY_CACHE_DIR":          "Registry cache directory",
		"REACH_REGISTRY_VERIFY_SIGNATURES":  "Verify registry signatures (default: true)",
		"REACH_TRUSTED_KEYS_PATH":           "Path to trusted plugin keys",
		"REACH_LOG_LEVEL":                   "Log level: debug, info, warn, error, fatal (default: info)",
		"REACH_LOG_DIR":                     "Log directory",
		"REACH_METRICS_ENABLED":             "Enable metrics (default: true)",
		"REACH_METRICS_PATH":                "Metrics output path",
		"REACH_TRACING_ENABLED":             "Enable tracing (default: false)",
		"REACH_SECRET_SCANNING_ENABLED":     "Enable secret scanning (default: true)",
		"REACH_MAX_SECRET_ENTROPY":          "Secret entropy threshold (default: 4.5)",
		"REACH_AUDIT_LOG_PATH":              "Audit log path",
		"REACH_DETERMINISM_STRICT":          "Strict determinism mode (default: false)",
		"REACH_DETERMINISM_VERIFY_ON_LOAD":  "Verify determinism on load (default: true)",
		"REACH_DETERMINISM_CANONICAL_TIME":  "Use canonical time format (default: true)",
		"REACH_CONFIG_PATH":                 "Path to config file",
	}
}

// PrintEnvDocs prints environment variable documentation.
func PrintEnvDocs() {
	fmt.Println("Reach Environment Variables")
	fmt.Println("===========================")
	fmt.Println()

	categories := map[string][]string{
		"Execution":   {},
		"Federation":  {},
		"Policy":      {},
		"Registry":    {},
		"Telemetry":   {},
		"Security":    {},
		"Determinism": {},
		"General":     {},
	}

	docs := GetEnvDocs()
	for env, doc := range docs {
		category := "General"
		switch {
		case strings.Contains(env, "CONCURRENT") || strings.Contains(env, "EVENT") || strings.Contains(env, "EXECUTION") || strings.Contains(env, "SANDBOX"):
			category = "Execution"
		case strings.Contains(env, "FEDERATION") || strings.Contains(env, "DELEGATION") || strings.Contains(env, "CIRCUIT") || strings.Contains(env, "HANDSHAKE"):
			category = "Federation"
		case strings.Contains(env, "POLICY"):
			category = "Policy"
		case strings.Contains(env, "REGISTRY"):
			category = "Registry"
		case strings.Contains(env, "LOG") || strings.Contains(env, "METRIC") || strings.Contains(env, "TRACING"):
			category = "Telemetry"
		case strings.Contains(env, "SECRET") || strings.Contains(env, "AUDIT") || strings.Contains(env, "ENTROPY"):
			category = "Security"
		case strings.Contains(env, "DETERMINISM"):
			category = "Determinism"
		}
		categories[category] = append(categories[category], fmt.Sprintf("  %-40s %s", env, doc))
	}

	for category, vars := range categories {
		if len(vars) > 0 {
			fmt.Printf("%s:\n", category)
			for _, v := range vars {
				fmt.Println(v)
			}
			fmt.Println()
		}
	}
}
func IsCloudEnabled() bool {
	return os.Getenv("REACH_CLOUD") == "1"
}
