// Package errors provides a strict error taxonomy for Reach.
// All errors in core paths must use ReachError with a defined code.
package errors

// Code is a string-based error code for classification.
type Code string

// Error codes organized by subsystem.
// Format: SUBSYSTEM_REASON_DETAIL
const (
	// General errors
	CodeUnknown           Code = "UNKNOWN_ERROR"
	CodeInternal          Code = "INTERNAL_ERROR"
	CodeNotImplemented    Code = "NOT_IMPLEMENTED"
	CodeInvalidArgument   Code = "INVALID_ARGUMENT"
	CodeTimeout           Code = "TIMEOUT"
	CodeCancelled         Code = "CANCELLED"
	CodeResourceExhausted Code = "RESOURCE_EXHAUSTED"
	CodeRateLimitExceeded Code = "RATE_LIMIT_EXCEEDED"

	// Execution errors
	CodeExecutionFailed    Code = "EXECUTION_FAILED"
	CodeExecutionTimeout   Code = "EXECUTION_TIMEOUT"
	CodeExecutionCancelled Code = "EXECUTION_CANCELLED"
	CodeMaxConcurrentRuns  Code = "MAX_CONCURRENT_RUNS_EXCEEDED"
	CodeEventLogTooLarge   Code = "EVENT_LOG_TOO_LARGE"

	// Policy errors
	CodePolicyDenied               Code = "POLICY_DENIED"
	CodePolicyInvalidSignature     Code = "POLICY_INVALID_SIGNATURE"
	CodePolicyUndeclaredTool       Code = "POLICY_UNDECLARED_TOOL"
	CodePolicyPermissionEscalation Code = "POLICY_PERMISSION_ESCALATION"
	CodePolicyModelNotAllowed      Code = "POLICY_MODEL_NOT_ALLOWED"
	CodePolicyDeterminismRequired  Code = "POLICY_DETERMINISM_REQUIRED"

	// Signature/verification errors
	CodeSignatureInvalid              Code = "SIGNATURE_INVALID"
	CodeSignatureMissing              Code = "SIGNATURE_MISSING"
	CodeSignatureVerifyFailed         Code = "SIGNATURE_VERIFY_FAILED"
	CodeSignatureAlgorithmUnsupported Code = "SIGNATURE_ALGORITHM_UNSUPPORTED"

	// Registry errors
	CodeRegistryNotFound        Code = "REGISTRY_NOT_FOUND"
	CodeRegistryInvalidManifest Code = "REGISTRY_INVALID_MANIFEST"
	CodeRegistryVersionMismatch Code = "REGISTRY_VERSION_MISMATCH"
	CodeRegistryInstallFailed   Code = "REGISTRY_INSTALL_FAILED"
	CodeRegistryVerifyFailed    Code = "REGISTRY_VERIFY_FAILED"
	CodeRegistryCorrupt         Code = "REGISTRY_CORRUPT"

	// Federation/mesh errors
	CodeFederationHandshakeFailed    Code = "FEDERATION_HANDSHAKE_FAILED"
	CodeFederationDelegationFailed   Code = "FEDERATION_DELEGATION_FAILED"
	CodeFederationNodeUnreachable    Code = "FEDERATION_NODE_UNREACHABLE"
	CodeFederationSpecMismatch       Code = "FEDERATION_SPEC_MISMATCH"
	CodeFederationPolicyMismatch     Code = "FEDERATION_POLICY_MISMATCH"
	CodeFederationRegistryMismatch   Code = "FEDERATION_REGISTRY_MISMATCH"
	CodeFederationReplayMismatch     Code = "FEDERATION_REPLAY_MISMATCH"
	CodeFederationCircuitOpen        Code = "FEDERATION_CIRCUIT_OPEN"
	CodeFederationMaxRetriesExceeded Code = "FEDERATION_MAX_RETRIES_EXCEEDED"
	CodeFederationNodeQuarantined    Code = "FEDERATION_NODE_QUARANTINED"

	// Replay/audit errors
	CodeReplayMismatch     Code = "REPLAY_MISMATCH"
	CodeReplayNotFound     Code = "REPLAY_NOT_FOUND"
	CodeReplayCorrupt      Code = "REPLAY_CORRUPT"
	CodeReplayVerifyFailed Code = "REPLAY_VERIFY_FAILED"

	// Config errors
	CodeConfigInvalid          Code = "CONFIG_INVALID"
	CodeConfigMissing          Code = "CONFIG_MISSING"
	CodeConfigTypeMismatch     Code = "CONFIG_TYPE_MISMATCH"
	CodeConfigValidationFailed Code = "CONFIG_VALIDATION_FAILED"

	// Storage errors
	CodeStorageReadFailed  Code = "STORAGE_READ_FAILED"
	CodeStorageWriteFailed Code = "STORAGE_WRITE_FAILED"
	CodeStorageNotFound    Code = "STORAGE_NOT_FOUND"
	CodeStorageCorrupt     Code = "STORAGE_CORRUPT"

	// Sandbox errors
	CodeSandboxCreateFailed  Code = "SANDBOX_CREATE_FAILED"
	CodeSandboxExecFailed    Code = "SANDBOX_EXEC_FAILED"
	CodeSandboxTimeout       Code = "SANDBOX_TIMEOUT"
	CodeSandboxResourceLimit Code = "SANDBOX_RESOURCE_LIMIT_EXCEEDED"
)

// Category returns the subsystem category for a code.
func (c Code) Category() string {
	switch {
	case len(c) == 0:
		return "unknown"
	case c == CodeUnknown || c == CodeInternal || c == CodeNotImplemented:
		return "general"
	case c == CodeExecutionFailed || c == CodeExecutionTimeout || c == CodeMaxConcurrentRuns:
		return "execution"
	case c == CodePolicyDenied || c == CodePolicyInvalidSignature || c == CodePolicyUndeclaredTool:
		return "policy"
	case c == CodeSignatureInvalid || c == CodeSignatureMissing || c == CodeSignatureVerifyFailed:
		return "signature"
	case c == CodeRegistryNotFound || c == CodeRegistryInvalidManifest || c == CodeRegistryCorrupt:
		return "registry"
	case c == CodeFederationHandshakeFailed || c == CodeFederationDelegationFailed || c == CodeFederationCircuitOpen:
		return "federation"
	case c == CodeReplayMismatch || c == CodeReplayNotFound || c == CodeReplayCorrupt:
		return "replay"
	case c == CodeConfigInvalid || c == CodeConfigMissing || c == CodeConfigValidationFailed:
		return "config"
	case c == CodeStorageReadFailed || c == CodeStorageWriteFailed || c == CodeStorageNotFound:
		return "storage"
	case c == CodeSandboxCreateFailed || c == CodeSandboxExecFailed || c == CodeSandboxTimeout:
		return "sandbox"
	default:
		return "other"
	}
}

// IsRetryable returns true if the error code suggests a retry might succeed.
func (c Code) IsRetryable() bool {
	switch c {
	case CodeTimeout,
		CodeFederationNodeUnreachable,
		CodeFederationDelegationFailed,
		CodeStorageReadFailed,
		CodeStorageWriteFailed,
		CodeResourceExhausted,
		CodeExecutionTimeout:
		return true
	default:
		return false
	}
}

// AllCodes returns all defined error codes for documentation generation.
func AllCodes() []Code {
	return []Code{
		CodeUnknown,
		CodeInternal,
		CodeNotImplemented,
		CodeInvalidArgument,
		CodeTimeout,
		CodeCancelled,
		CodeResourceExhausted,
		CodeExecutionFailed,
		CodeExecutionTimeout,
		CodeExecutionCancelled,
		CodeMaxConcurrentRuns,
		CodeEventLogTooLarge,
		CodePolicyDenied,
		CodePolicyInvalidSignature,
		CodePolicyUndeclaredTool,
		CodePolicyPermissionEscalation,
		CodePolicyModelNotAllowed,
		CodePolicyDeterminismRequired,
		CodeSignatureInvalid,
		CodeSignatureMissing,
		CodeSignatureVerifyFailed,
		CodeSignatureAlgorithmUnsupported,
		CodeRegistryNotFound,
		CodeRegistryInvalidManifest,
		CodeRegistryVersionMismatch,
		CodeRegistryInstallFailed,
		CodeRegistryVerifyFailed,
		CodeRegistryCorrupt,
		CodeFederationHandshakeFailed,
		CodeFederationDelegationFailed,
		CodeFederationNodeUnreachable,
		CodeFederationSpecMismatch,
		CodeFederationPolicyMismatch,
		CodeFederationRegistryMismatch,
		CodeFederationReplayMismatch,
		CodeFederationCircuitOpen,
		CodeFederationMaxRetriesExceeded,
		CodeFederationNodeQuarantined,
		CodeReplayMismatch,
		CodeReplayNotFound,
		CodeReplayCorrupt,
		CodeReplayVerifyFailed,
		CodeConfigInvalid,
		CodeConfigMissing,
		CodeConfigTypeMismatch,
		CodeConfigValidationFailed,
		CodeStorageReadFailed,
		CodeStorageWriteFailed,
		CodeStorageNotFound,
		CodeStorageCorrupt,
		CodeSandboxCreateFailed,
		CodeSandboxExecFailed,
		CodeSandboxTimeout,
		CodeSandboxResourceLimit,
	}
}
