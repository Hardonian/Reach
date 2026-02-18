// Package config provides typed, validated configuration for Reach.
// Configuration resolution order (highest priority first):
// 1. Environment variables (REACH_*)
// 2. Config file (~/.reach/config.json or REACH_CONFIG_PATH)
// 3. Defaults
package config

import (
	"time"
)

// Config is the top-level configuration structure.
type Config struct {
	// Execution controls execution behavior
	Execution ExecutionConfig `json:"execution"`

	// Federation controls federation/mesh behavior
	Federation FederationConfig `json:"federation"`

	// Policy controls policy enforcement
	Policy PolicyConfig `json:"policy"`

	// Registry controls registry behavior
	Registry RegistryConfig `json:"registry"`

	// Telemetry controls observability
	Telemetry TelemetryConfig `json:"telemetry"`

	// Security controls security settings
	Security SecurityConfig `json:"security"`

	// Determinism controls determinism guarantees
	Determinism DeterminismConfig `json:"determinism"`
}

// ExecutionConfig controls execution behavior.
type ExecutionConfig struct {
	// MaxConcurrentRuns limits concurrent executions (0 = unlimited)
	MaxConcurrentRuns int `json:"max_concurrent_runs" env:"REACH_MAX_CONCURRENT_RUNS" default:"10"`

	// MaxEventBytes warns/fails on large event logs (0 = no limit)
	MaxEventBytes int64 `json:"max_event_bytes" env:"REACH_MAX_EVENT_BYTES" default:"104857600"` // 100MB

	// EventLogMode determines behavior when max is exceeded: "warn" or "fail"
	EventLogMode string `json:"event_log_mode" env:"REACH_EVENT_LOG_MODE" default:"warn"`

	// ExecutionTimeout is the default timeout for executions
	ExecutionTimeout time.Duration `json:"execution_timeout" env:"REACH_EXECUTION_TIMEOUT" default:"5m"`

	// SandboxEnabled controls whether sandboxing is used
	SandboxEnabled bool `json:"sandbox_enabled" env:"REACH_SANDBOX_ENABLED" default:"true"`
}

// FederationConfig controls federation behavior.
type FederationConfig struct {
	// Enabled controls whether federation is enabled
	Enabled bool `json:"enabled" env:"REACH_FEDERATION_ENABLED" default:"true"`

	// MaxDelegationRetries limits retries per delegation
	MaxDelegationRetries int `json:"max_delegation_retries" env:"REACH_MAX_DELEGATION_RETRIES" default:"3"`

	// DelegationRetryBaseMs is the base retry delay in milliseconds
	DelegationRetryBaseMs int `json:"delegation_retry_base_ms" env:"REACH_DELEGATION_RETRY_BASE_MS" default:"100"`

	// DelegationRetryMaxMs is the max retry delay in milliseconds
	DelegationRetryMaxMs int `json:"delegation_retry_max_ms" env:"REACH_DELEGATION_RETRY_MAX_MS" default:"30000"`

	// CircuitBreakerThreshold is failures before opening circuit
	CircuitBreakerThreshold int `json:"circuit_breaker_threshold" env:"REACH_CIRCUIT_BREAKER_THRESHOLD" default:"5"`

	// CircuitBreakerTimeout is how long circuit stays open
	CircuitBreakerTimeout time.Duration `json:"circuit_breaker_timeout" env:"REACH_CIRCUIT_BREAKER_TIMEOUT" default:"30s"`

	// HandshakeTTL is the challenge/response TTL
	HandshakeTTL time.Duration `json:"handshake_ttl" env:"REACH_HANDSHAKE_TTL" default:"5m"`

	// MaxDelegationLatencyMs is the max acceptable delegation latency
	MaxDelegationLatencyMs int `json:"max_delegation_latency_ms" env:"REACH_MAX_DELEGATION_LATENCY_MS" default:"5000"`
}

// PolicyConfig controls policy enforcement.
type PolicyConfig struct {
	// Mode is "enforce" or "warn"
	Mode string `json:"mode" env:"REACH_POLICY_MODE" default:"enforce"`

	// AllowLegacyUnsigned allows unsigned legacy packs
	AllowLegacyUnsigned bool `json:"allow_legacy_unsigned" env:"REACH_ALLOW_LEGACY_UNSIGNED_PACKS" default:"false"`

	// RequireDeterministic requires deterministic execution
	RequireDeterministic bool `json:"require_deterministic" env:"REACH_REQUIRE_DETERMINISTIC" default:"false"`

	// PolicyPath is the path to policy files
	PolicyPath string `json:"policy_path" env:"REACH_POLICY_PATH" default:""`
}

// RegistryConfig controls registry behavior.
type RegistryConfig struct {
	// URL is the registry URL
	URL string `json:"url" env:"REACH_REGISTRY_URL" default:"https://registry.reach.dev"`

	// CacheDir is where registry data is cached
	CacheDir string `json:"cache_dir" env:"REACH_REGISTRY_CACHE_DIR" default:""`

	// VerifySignatures requires signature verification
	VerifySignatures bool `json:"verify_signatures" env:"REACH_REGISTRY_VERIFY_SIGNATURES" default:"true"`

	// TrustedKeysPath is path to trusted plugin keys
	TrustedKeysPath string `json:"trusted_keys_path" env:"REACH_TRUSTED_KEYS_PATH" default:""`
}

// TelemetryConfig controls observability.
type TelemetryConfig struct {
	// LogLevel is the minimum log level
	LogLevel string `json:"log_level" env:"REACH_LOG_LEVEL" default:"info"`

	// LogDir is where logs are written
	LogDir string `json:"log_dir" env:"REACH_LOG_DIR" default:""`

	// MetricsEnabled controls whether metrics are collected
	MetricsEnabled bool `json:"metrics_enabled" env:"REACH_METRICS_ENABLED" default:"true"`

	// MetricsPath is where metrics are written
	MetricsPath string `json:"metrics_path" env:"REACH_METRICS_PATH" default:""`

	// TracingEnabled controls whether tracing is enabled
	TracingEnabled bool `json:"tracing_enabled" env:"REACH_TRACING_ENABLED" default:"false"`
}

// SecurityConfig controls security settings.
type SecurityConfig struct {
	// SecretScanningEnabled scans for secrets in output
	SecretScanningEnabled bool `json:"secret_scanning_enabled" env:"REACH_SECRET_SCANNING_ENABLED" default:"true"`

	// MaxSecretEntropy is the entropy threshold for secret detection
	MaxSecretEntropy float64 `json:"max_secret_entropy" env:"REACH_MAX_SECRET_ENTROPY" default:"4.5"`

	// AuditLogPath is where audit logs are written
	AuditLogPath string `json:"audit_log_path" env:"REACH_AUDIT_LOG_PATH" default:""`
}

// DeterminismConfig controls determinism guarantees.
type DeterminismConfig struct {
	// StrictMode enables strict determinism checks
	StrictMode bool `json:"strict_mode" env:"REACH_DETERMINISM_STRICT" default:"false"`

	// VerifyOnLoad verifies determinism on pack load
	VerifyOnLoad bool `json:"verify_on_load" env:"REACH_DETERMINISM_VERIFY_ON_LOAD" default:"true"`

	// CanonicalTimeFormat uses canonical time formatting
	CanonicalTimeFormat bool `json:"canonical_time_format" env:"REACH_DETERMINISM_CANONICAL_TIME" default:"true"`
}

// Default returns the default configuration.
func Default() *Config {
	return &Config{
		Execution: ExecutionConfig{
			MaxConcurrentRuns: 10,
			MaxEventBytes:     100 * 1024 * 1024, // 100MB
			EventLogMode:      "warn",
			ExecutionTimeout:  5 * time.Minute,
			SandboxEnabled:    true,
		},
		Federation: FederationConfig{
			Enabled:                 true,
			MaxDelegationRetries:    3,
			DelegationRetryBaseMs:   100,
			DelegationRetryMaxMs:    30000,
			CircuitBreakerThreshold: 5,
			CircuitBreakerTimeout:   30 * time.Second,
			HandshakeTTL:            5 * time.Minute,
			MaxDelegationLatencyMs:  5000,
		},
		Policy: PolicyConfig{
			Mode:                 "enforce",
			AllowLegacyUnsigned:  false,
			RequireDeterministic: false,
		},
		Registry: RegistryConfig{
			URL:              "https://registry.reach.dev",
			VerifySignatures: true,
		},
		Telemetry: TelemetryConfig{
			LogLevel:       "info",
			MetricsEnabled: true,
		},
		Security: SecurityConfig{
			SecretScanningEnabled: true,
			MaxSecretEntropy:      4.5,
		},
		Determinism: DeterminismConfig{
			StrictMode:          false,
			VerifyOnLoad:        true,
			CanonicalTimeFormat: true,
		},
	}
}
