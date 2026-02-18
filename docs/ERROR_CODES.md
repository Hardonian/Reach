# Reach Error Codes

This document describes the canonical error codes used throughout Reach. All errors in core paths use `ReachError` with one of these codes.

## Error Code Format

Codes follow the pattern: `SUBSYSTEM_REASON_DETAIL`

## General Errors

| Code | Meaning | Remediation |
|------|---------|-------------|
| `UNKNOWN_ERROR` | An unexpected error occurred | Check logs for details; report if reproducible |
| `INTERNAL_ERROR` | An internal system error occurred | Check component health; restart if necessary |
| `NOT_IMPLEMENTED` | Feature not yet implemented | Upgrade to a newer version or use alternative |
| `INVALID_ARGUMENT` | Invalid input provided | Check API documentation for correct parameters |
| `TIMEOUT` | Operation timed out | Retry with longer timeout or check resource availability |
| `CANCELLED` | Operation was cancelled | Check if cancelled by user or system |
| `RESOURCE_EXHAUSTED` | System resources exhausted | Free resources or scale up capacity |

## Execution Errors

| Code | Meaning | Remediation |
|------|---------|-------------|
| `EXECUTION_FAILED` | Execution failed | Check execution logs for failure details |
| `EXECUTION_TIMEOUT` | Execution timed out | Increase timeout or optimize execution |
| `EXECUTION_CANCELLED` | Execution was cancelled | Check cancellation reason |
| `MAX_CONCURRENT_RUNS_EXCEEDED` | Too many concurrent runs | Wait for existing runs to complete or increase limit |
| `EVENT_LOG_TOO_LARGE` | Event log exceeds size limit | Reduce logging or increase limit |

## Policy Errors

| Code | Meaning | Remediation |
|------|---------|-------------|
| `POLICY_DENIED` | Request denied by policy | Review policy requirements and adjust request |
| `POLICY_INVALID_SIGNATURE` | Invalid or missing signature | Ensure pack is properly signed |
| `POLICY_UNDECLARED_TOOL` | Tool not declared in pack | Add tool to pack manifest |
| `POLICY_PERMISSION_ESCALATION` | Permission escalation detected | Reduce requested permissions |
| `POLICY_MODEL_NOT_ALLOWED` | Model not in allowed list | Use an allowed model or update policy |
| `POLICY_DETERMINISM_REQUIRED` | Determinism required but not provided | Enable deterministic mode |

## Signature/Verification Errors

| Code | Meaning | Remediation |
|------|---------|-------------|
| `SIGNATURE_INVALID` | Signature verification failed | Check signature format and key |
| `SIGNATURE_MISSING` | Required signature is missing | Add required signature |
| `SIGNATURE_VERIFY_FAILED` | Signature verification error | Check key and algorithm compatibility |
| `SIGNATURE_ALGORITHM_UNSUPPORTED` | Signature algorithm not supported | Use a supported algorithm |

## Registry Errors

| Code | Meaning | Remediation |
|------|---------|-------------|
| `REGISTRY_NOT_FOUND` | Registry or pack not found | Check registry URL and pack ID |
| `REGISTRY_INVALID_MANIFEST` | Invalid manifest format | Validate manifest against schema |
| `REGISTRY_VERSION_MISMATCH` | Version incompatible | Update pack or registry client |
| `REGISTRY_INSTALL_FAILED` | Pack installation failed | Check permissions and disk space |
| `REGISTRY_VERIFY_FAILED` | Pack verification failed | Check signatures and integrity |
| `REGISTRY_CORRUPT` | Registry data corrupt | Clear cache and retry |

## Federation/Mesh Errors

| Code | Meaning | Remediation |
|------|---------|-------------|
| `FEDERATION_HANDSHAKE_FAILED` | Node handshake failed | Check network and credentials |
| `FEDERATION_DELEGATION_FAILED` | Delegation to node failed | Check node health and retry |
| `FEDERATION_NODE_UNREACHABLE` | Node is unreachable | Check network connectivity |
| `FEDERATION_SPEC_MISMATCH` | Protocol version mismatch | Update node or client |
| `FEDERATION_POLICY_MISMATCH` | Policy version mismatch | Synchronize policies |
| `FEDERATION_REGISTRY_MISMATCH` | Registry version mismatch | Synchronize registries |
| `FEDERATION_REPLAY_MISMATCH` | Replay verification failed | Check determinism settings |
| `FEDERATION_CIRCUIT_OPEN` | Circuit breaker is open | Wait for circuit to close |
| `FEDERATION_MAX_RETRIES_EXCEEDED` | Max retries exceeded | Check node health and retry later |
| `FEDERATION_NODE_QUARANTINED` | Node is quarantined | Wait for quarantine to lift |

## Replay/Audit Errors

| Code | Meaning | Remediation |
|------|---------|-------------|
| `REPLAY_MISMATCH` | Replay does not match original | Check for non-deterministic operations |
| `REPLAY_NOT_FOUND` | Replay data not found | Check replay storage |
| `REPLAY_CORRUPT` | Replay data is corrupt | Restore from backup |
| `REPLAY_VERIFY_FAILED` | Replay verification failed | Check integrity of replay data |

## Config Errors

| Code | Meaning | Remediation |
|------|---------|-------------|
| `CONFIG_INVALID` | Invalid configuration value | Check configuration documentation |
| `CONFIG_MISSING` | Required configuration missing | Set required configuration |
| `CONFIG_TYPE_MISMATCH` | Configuration type mismatch | Check configuration format |
| `CONFIG_VALIDATION_FAILED` | Configuration validation failed | Review validation errors |

## Storage Errors

| Code | Meaning | Remediation |
|------|---------|-------------|
| `STORAGE_READ_FAILED` | Failed to read from storage | Check permissions and connectivity |
| `STORAGE_WRITE_FAILED` | Failed to write to storage | Check permissions and disk space |
| `STORAGE_NOT_FOUND` | Storage resource not found | Check path and existence |
| `STORAGE_CORRUPT` | Storage data is corrupt | Restore from backup |

## Sandbox Errors

| Code | Meaning | Remediation |
|------|---------|-------------|
| `SANDBOX_CREATE_FAILED` | Failed to create sandbox | Check sandbox prerequisites |
| `SANDBOX_EXEC_FAILED` | Sandbox execution failed | Check sandbox logs |
| `SANDBOX_TIMEOUT` | Sandbox execution timed out | Increase timeout or optimize |
| `SANDBOX_RESOURCE_LIMIT_EXCEEDED` | Sandbox resource limit exceeded | Increase limits or reduce usage |

## Retryability

Errors marked as **retryable** may succeed on retry:
- `TIMEOUT`
- `FEDERATION_NODE_UNREACHABLE`
- `FEDERATION_DELEGATION_FAILED`
- `STORAGE_READ_FAILED`
- `STORAGE_WRITE_FAILED`
- `RESOURCE_EXHAUSTED`
- `EXECUTION_TIMEOUT`

Errors **not retryable** (fix required):
- `POLICY_DENIED`
- `SIGNATURE_INVALID`
- `INVALID_ARGUMENT`
- `NOT_IMPLEMENTED`

## Using Error Codes

### Creating Errors

```go
import "reach/services/runner/internal/errors"

// Simple error
err := errors.New(errors.CodePolicyDenied, "access denied")

// With context
err := errors.New(errors.CodeExecutionFailed, "execution failed").
    WithContext("run_id", runID).
    WithCause(originalErr)

// Wrap existing error
err := errors.Wrap(originalErr, errors.CodeInternal, "operation failed")
```

### Classifying Errors

```go
// Classify unknown errors at system boundaries
reachErr := errors.Classify(err)

// Check if retryable
if errors.IsRetryable(err) {
    // Retry logic
}

// Get error code
code := errors.GetCode(err)
```

### Safe Logging

```go
// Redact sensitive information
safeMsg := errors.Redact(err.Error())

// Format for logging
logMsg := errors.FormatSafe(err)
```
