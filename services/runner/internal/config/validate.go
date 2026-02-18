package config

import (
	"fmt"
	"path/filepath"
	"strings"
)

// ValidationError represents a configuration validation error.
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("config validation error: %s: %s", e.Field, e.Message)
}

// ValidationResult contains validation errors.
type ValidationResult struct {
	Errors []*ValidationError
}

// Valid returns true if there are no validation errors.
func (r *ValidationResult) Valid() bool {
	return len(r.Errors) == 0
}

// Error returns a formatted error string.
func (r *ValidationResult) Error() string {
	if r.Valid() {
		return ""
	}
	var msgs []string
	for _, e := range r.Errors {
		msgs = append(msgs, e.Error())
	}
	return strings.Join(msgs, "; ")
}

// Validate validates the configuration.
func (c *Config) Validate() *ValidationResult {
	result := &ValidationResult{
		Errors: make([]*ValidationError, 0),
	}

	// Execution validation
	result.validateExecution(c)

	// Federation validation
	result.validateFederation(c)

	// Policy validation
	result.validatePolicy(c)

	// Registry validation
	result.validateRegistry(c)

	// Telemetry validation
	result.validateTelemetry(c)

	// Security validation
	result.validateSecurity(c)

	// Determinism validation
	result.validateDeterminism(c)

	return result
}

func (r *ValidationResult) validateExecution(c *Config) {
	if c.Execution.MaxConcurrentRuns < 0 {
		r.add("execution.max_concurrent_runs", "must be >= 0 (0 = unlimited)")
	}
	if c.Execution.MaxEventBytes < 0 {
		r.add("execution.max_event_bytes", "must be >= 0 (0 = no limit)")
	}
	if c.Execution.EventLogMode != "warn" && c.Execution.EventLogMode != "fail" {
		r.add("execution.event_log_mode", "must be 'warn' or 'fail'")
	}
	if c.Execution.ExecutionTimeout <= 0 {
		r.add("execution.execution_timeout", "must be > 0")
	}
}

func (r *ValidationResult) validateFederation(c *Config) {
	if !c.Federation.Enabled {
		return
	}

	if c.Federation.MaxDelegationRetries < 0 {
		r.add("federation.max_delegation_retries", "must be >= 0")
	}
	if c.Federation.DelegationRetryBaseMs < 0 {
		r.add("federation.delegation_retry_base_ms", "must be >= 0")
	}
	if c.Federation.DelegationRetryMaxMs < c.Federation.DelegationRetryBaseMs {
		r.add("federation.delegation_retry_max_ms", "must be >= delegation_retry_base_ms")
	}
	if c.Federation.CircuitBreakerThreshold < 1 {
		r.add("federation.circuit_breaker_threshold", "must be >= 1")
	}
	if c.Federation.CircuitBreakerTimeout <= 0 {
		r.add("federation.circuit_breaker_timeout", "must be > 0")
	}
	if c.Federation.HandshakeTTL <= 0 {
		r.add("federation.handshake_ttl", "must be > 0")
	}
	if c.Federation.MaxDelegationLatencyMs <= 0 {
		r.add("federation.max_delegation_latency_ms", "must be > 0")
	}
}

func (r *ValidationResult) validatePolicy(c *Config) {
	if c.Policy.Mode != "enforce" && c.Policy.Mode != "warn" {
		r.add("policy.mode", "must be 'enforce' or 'warn'")
	}
	if c.Policy.PolicyPath != "" {
		if !filepath.IsAbs(c.Policy.PolicyPath) {
			r.add("policy.policy_path", "must be an absolute path")
		}
	}
}

func (r *ValidationResult) validateRegistry(c *Config) {
	if c.Registry.URL == "" {
		r.add("registry.url", "must not be empty")
	}
	if !strings.HasPrefix(c.Registry.URL, "http://") && !strings.HasPrefix(c.Registry.URL, "https://") {
		r.add("registry.url", "must start with http:// or https://")
	}
	if c.Registry.CacheDir != "" {
		if !filepath.IsAbs(c.Registry.CacheDir) {
			r.add("registry.cache_dir", "must be an absolute path")
		}
	}
}

func (r *ValidationResult) validateTelemetry(c *Config) {
	validLevels := map[string]bool{"debug": true, "info": true, "warn": true, "error": true, "fatal": true}
	if !validLevels[c.Telemetry.LogLevel] {
		r.add("telemetry.log_level", "must be one of: debug, info, warn, error, fatal")
	}
	if c.Telemetry.LogDir != "" {
		if !filepath.IsAbs(c.Telemetry.LogDir) {
			r.add("telemetry.log_dir", "must be an absolute path")
		}
	}
}

func (r *ValidationResult) validateSecurity(c *Config) {
	if c.Security.MaxSecretEntropy < 0 {
		r.add("security.max_secret_entropy", "must be >= 0")
	}
	if c.Security.AuditLogPath != "" {
		if !filepath.IsAbs(c.Security.AuditLogPath) {
			r.add("security.audit_log_path", "must be an absolute path")
		}
	}
}

func (r *ValidationResult) validateDeterminism(c *Config) {
	// Determinism settings are boolean, always valid
}

func (r *ValidationResult) add(field, message string) {
	r.Errors = append(r.Errors, &ValidationError{
		Field:   field,
		Message: message,
	})
}

// MustValidate validates the config and panics if invalid.
func (c *Config) MustValidate() {
	result := c.Validate()
	if !result.Valid() {
		panic(result.Error())
	}
}

// ValidateWithDefaults validates and applies defaults for missing values.
func (c *Config) ValidateWithDefaults() error {
	defaults := Default()

	// Apply defaults for zero values
	if c.Execution.MaxConcurrentRuns == 0 {
		c.Execution.MaxConcurrentRuns = defaults.Execution.MaxConcurrentRuns
	}
	if c.Execution.MaxEventBytes == 0 {
		c.Execution.MaxEventBytes = defaults.Execution.MaxEventBytes
	}
	if c.Execution.EventLogMode == "" {
		c.Execution.EventLogMode = defaults.Execution.EventLogMode
	}
	if c.Execution.ExecutionTimeout == 0 {
		c.Execution.ExecutionTimeout = defaults.Execution.ExecutionTimeout
	}
	if c.Federation.MaxDelegationRetries == 0 {
		c.Federation.MaxDelegationRetries = defaults.Federation.MaxDelegationRetries
	}
	if c.Federation.DelegationRetryBaseMs == 0 {
		c.Federation.DelegationRetryBaseMs = defaults.Federation.DelegationRetryBaseMs
	}
	if c.Federation.DelegationRetryMaxMs == 0 {
		c.Federation.DelegationRetryMaxMs = defaults.Federation.DelegationRetryMaxMs
	}
	if c.Federation.CircuitBreakerThreshold == 0 {
		c.Federation.CircuitBreakerThreshold = defaults.Federation.CircuitBreakerThreshold
	}
	if c.Federation.CircuitBreakerTimeout == 0 {
		c.Federation.CircuitBreakerTimeout = defaults.Federation.CircuitBreakerTimeout
	}
	if c.Federation.HandshakeTTL == 0 {
		c.Federation.HandshakeTTL = defaults.Federation.HandshakeTTL
	}
	if c.Federation.MaxDelegationLatencyMs == 0 {
		c.Federation.MaxDelegationLatencyMs = defaults.Federation.MaxDelegationLatencyMs
	}
	if c.Policy.Mode == "" {
		c.Policy.Mode = defaults.Policy.Mode
	}
	if c.Registry.URL == "" {
		c.Registry.URL = defaults.Registry.URL
	}
	if c.Telemetry.LogLevel == "" {
		c.Telemetry.LogLevel = defaults.Telemetry.LogLevel
	}

	result := c.Validate()
	if !result.Valid() {
		return fmt.Errorf("configuration validation failed: %s", result.Error())
	}

	return nil
}
