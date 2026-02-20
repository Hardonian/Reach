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

	// EdgeMode controls constrained environment behavior
	EdgeMode EdgeModeConfig `json:"edge_mode"`

	// Model controls LLM adapter configuration
	Model ModelConfig `json:"model"`

	// Mesh controls distributed agent mesh coordination.
	// Disabled by default — must be explicitly enabled. Single-node users are never affected.
	Mesh MeshConfig `json:"mesh"`
}

// MeshConfig controls the distributed agent mesh layer.
// The entire mesh layer is gated behind Enabled=false by default.
type MeshConfig struct {
	// Enabled is the master switch for the mesh layer. Disabled by default.
	Enabled bool `json:"enabled" env:"REACH_MESH_ENABLED" default:"false"`

	// DataDir is where mesh state (keys, peer store) is persisted
	DataDir string `json:"data_dir" env:"REACH_MESH_DATA_DIR" default:""`

	// ListenPort is the mesh transport port (0 = random)
	ListenPort int `json:"listen_port" env:"REACH_MESH_LISTEN_PORT" default:"0"`

	// MaxHops limits task routing chain depth
	MaxHops int `json:"max_hops" env:"REACH_MESH_MAX_HOPS" default:"5"`

	// RateLimitPerNodePerMinute limits inbound requests from any single peer
	RateLimitPerNodePerMinute int `json:"rate_limit_per_node_per_minute" env:"REACH_MESH_RATE_LIMIT_PER_NODE" default:"60"`

	// GlobalRateLimitPerMinute limits total inbound mesh requests
	GlobalRateLimitPerMinute int `json:"global_rate_limit_per_minute" env:"REACH_MESH_GLOBAL_RATE_LIMIT" default:"300"`

	// MaxConcurrentTasks limits simultaneous mesh task executions
	MaxConcurrentTasks int `json:"max_concurrent_tasks" env:"REACH_MESH_MAX_CONCURRENT_TASKS" default:"10"`

	// TaskRoutingEnabled enables cross-node task routing (requires Enabled=true)
	TaskRoutingEnabled bool `json:"task_routing_enabled" env:"REACH_MESH_TASK_ROUTING" default:"false"`

	// CorrelationLogging enables cross-node correlation ID logging
	CorrelationLogging bool `json:"correlation_logging" env:"REACH_MESH_CORRELATION_LOGGING" default:"true"`
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

	// StreamingReplay enables memory-efficient streaming replay
	StreamingReplay bool `json:"streaming_replay" env:"REACH_STREAMING_REPLAY" default:"false"`

	// MaxEventBufferSize limits in-memory event buffer (0 = unlimited)
	MaxEventBufferSize int `json:"max_event_buffer_size" env:"REACH_MAX_EVENT_BUFFER_SIZE" default:"0"`
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

// EdgeModeConfig controls constrained environment behavior.
type EdgeModeConfig struct {
	// Enabled forces edge mode regardless of auto-detection
	Enabled bool `json:"enabled" env:"REACH_EDGE_MODE" default:"false"`

	// AutoDetect enables automatic edge mode detection
	AutoDetect bool `json:"auto_detect" env:"REACH_EDGE_AUTO_DETECT" default:"true"`

	// MaxContextTokens limits prompt context size
	MaxContextTokens int `json:"max_context_tokens" env:"REACH_EDGE_MAX_CONTEXT" default:"4096"`

	// DisableBranching prevents recursive execution branching
	DisableBranching bool `json:"disable_branching" env:"REACH_EDGE_DISABLE_BRANCHING" default:"true"`

	// SimplifyReasoning reduces reasoning complexity
	SimplifyReasoning bool `json:"simplify_reasoning" env:"REACH_EDGE_SIMPLIFY_REASONING" default:"true"`

	// MaxConcurrentRuns limits concurrency in edge mode (overrides ExecutionConfig)
	MaxConcurrentRuns int `json:"max_concurrent_runs" env:"REACH_EDGE_MAX_CONCURRENT" default:"2"`

	// MemoryCapMB limits memory usage (0 = no limit)
	MemoryCapMB int `json:"memory_cap_mb" env:"REACH_EDGE_MEMORY_CAP_MB" default:"512"`
}

// ModelConfig controls LLM adapter configuration.
type ModelConfig struct {
	// Mode is "auto", "hosted", "local", "edge"
	Mode string `json:"mode" env:"REACH_MODEL_MODE" default:"auto"`

	// HostedEndpoint is the cloud LLM API endpoint
	HostedEndpoint string `json:"hosted_endpoint" env:"REACH_MODEL_HOSTED_ENDPOINT" default:""`

	// HostedAPIKey for authentication
	HostedAPIKey string `json:"hosted_api_key" env:"REACH_MODEL_HOSTED_API_KEY" default:""`

	// HostedModelID is the model to use
	HostedModelID string `json:"hosted_model_id" env:"REACH_MODEL_HOSTED_MODEL_ID" default:""`

	// LocalEndpoint is the local LLM server (Ollama, etc)
	LocalEndpoint string `json:"local_endpoint" env:"REACH_MODEL_LOCAL_ENDPOINT" default:"http://localhost:11434"`

	// LocalModelID is the local model name
	LocalModelID string `json:"local_model_id" env:"REACH_MODEL_LOCAL_MODEL_ID" default:""`
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
		Mesh: MeshConfig{
			Enabled:                   false, // Disabled by default — must opt in
			MaxHops:                   5,
			RateLimitPerNodePerMinute: 60,
			GlobalRateLimitPerMinute:  300,
			MaxConcurrentTasks:        10,
			TaskRoutingEnabled:        false,
			CorrelationLogging:        true,
		},
	}
}
