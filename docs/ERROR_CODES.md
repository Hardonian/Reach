# Reach Error Codes Reference This document provides a comprehensive reference for all error codes in the Reach system.

## Overview Reach uses a structured error taxonomy with string-based error codes. All errors in core paths use `ReachError` with a defined code for consistent error handling and debugging.

## Error Code Format Error codes follow the format: `SUBSYSTEM_REASON_DETAIL`

- **SUBSYSTEM**: The component that generated the error (e.g., POLICY, FEDERATION, STORAGE)
- **REASON**: The general reason for the error (e.g., DENIED, FAILED, INVALID)
- **DETAIL**: Specific detail about the error (e.g., SIGNATURE, TIMEOUT, NOT_FOUND)

## Error Categories ### General Errors

| Code | Description | Retryable | HTTP Status |
|------|-------------|-----------|-------------|
| `UNKNOWN_ERROR` | An unknown error occurred | No | 500 |
| `INTERNAL_ERROR` | Internal server error | No | 500 |
| `NOT_IMPLEMENTED` | Feature not implemented | No | 501 |
| `INVALID_ARGUMENT` | Invalid argument provided | No | 400 |
| `TIMEOUT` | Operation timed out | Yes | 504 |
| `CANCELLED` | Operation was cancelled | No | 499 |
| `RESOURCE_EXHAUSTED` | Resource limits exceeded | Yes | 429 |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded | Yes | 429 |

### Execution Errors | Code | Description | Retryable | HTTP Status |
|------|-------------|-----------|-------------|
| `EXECUTION_FAILED` | Execution failed | No | 500 |
| `EXECUTION_TIMEOUT` | Execution timed out | Yes | 504 |
| `EXECUTION_CANCELLED` | Execution was cancelled | No | 499 |
| `MAX_CONCURRENT_RUNS_EXCEEDED` | Too many concurrent runs | Yes | 429 |
| `EVENT_LOG_TOO_LARGE` | Event log exceeds size limit | No | 413 |

### Policy Errors | Code | Description | Retryable | HTTP Status |
|------|-------------|-----------|-------------|
| `POLICY_DENIED` | Operation denied by policy | No | 403 |
| `POLICY_INVALID_SIGNATURE` | Invalid policy signature | No | 403 |
| `POLICY_UNDECLARED_TOOL` | Tool not declared in policy | No | 403 |
| `POLICY_PERMISSION_ESCALATION` | Permission escalation detected | No | 403 |
| `POLICY_MODEL_NOT_ALLOWED` | Model not allowed by policy | No | 403 |
| `POLICY_DETERMINISM_REQUIRED` | Determinism required but not provided | No | 403 |

### Signature/Verification Errors | Code | Description | Retryable | HTTP Status |
|------|-------------|-----------|-------------|
| `SIGNATURE_INVALID` | Invalid signature | No | 403 |
| `SIGNATURE_MISSING` | Missing signature | No | 403 |
| `SIGNATURE_VERIFY_FAILED` | Signature verification failed | No | 403 |
| `SIGNATURE_ALGORITHM_UNSUPPORTED` | Unsupported signature algorithm | No | 400 |

### Registry Errors | Code | Description | Retryable | HTTP Status |
|------|-------------|-----------|-------------|
| `REGISTRY_NOT_FOUND` | Registry not found | No | 404 |
| `REGISTRY_INVALID_MANIFEST` | Invalid registry manifest | No | 400 |
| `REGISTRY_VERSION_MISMATCH` | Registry version mismatch | No | 400 |
| `REGISTRY_INSTALL_FAILED` | Pack installation failed | Yes | 500 |
| `REGISTRY_VERIFY_FAILED` | Pack verification failed | No | 400 |
| `REGISTRY_CORRUPT` | Registry data is corrupt | No | 500 |

### Federation/Mesh Errors | Code | Description | Retryable | HTTP Status |
|------|-------------|-----------|-------------|
| `FEDERATION_HANDSHAKE_FAILED` | Federation handshake failed | Yes | 502 |
| `FEDERATION_DELEGATION_FAILED` | Delegation to node failed | Yes | 502 |
| `FEDERATION_NODE_UNREACHABLE` | Federation node unreachable | Yes | 503 |
| `FEDERATION_SPEC_MISMATCH` | Spec version mismatch | No | 400 |
| `FEDERATION_POLICY_MISMATCH` | Policy mismatch | No | 403 |
| `FEDERATION_REGISTRY_MISMATCH` | Registry mismatch | No | 409 |
| `FEDERATION_REPLAY_MISMATCH` | Replay verification failed | No | 409 |
| `FEDERATION_CIRCUIT_OPEN` | Circuit breaker is open | Yes | 503 |
| `FEDERATION_MAX_RETRIES_EXCEEDED` | Max retries exceeded | No | 503 |
| `FEDERATION_NODE_QUARANTINED` | Node is quarantined | Yes | 503 |

### Replay/Audit Errors | Code | Description | Retryable | HTTP Status |
|------|-------------|-----------|-------------|
| `REPLAY_MISMATCH` | Replay mismatch detected | No | 409 |
| `REPLAY_NOT_FOUND` | Replay data not found | No | 404 |
| `REPLAY_CORRUPT` | Replay data is corrupt | No | 500 |
| `REPLAY_VERIFY_FAILED` | Replay verification failed | No | 400 |

### Config Errors | Code | Description | Retryable | HTTP Status |
|------|-------------|-----------|-------------|
| `CONFIG_INVALID` | Invalid configuration | No | 400 |
| `CONFIG_MISSING` | Missing configuration | No | 400 |
| `CONFIG_TYPE_MISMATCH` | Configuration type mismatch | No | 400 |
| `CONFIG_VALIDATION_FAILED` | Configuration validation failed | No | 400 |

### Storage Errors | Code | Description | Retryable | HTTP Status |
|------|-------------|-----------|-------------|
| `STORAGE_READ_FAILED` | Storage read failed | Yes | 500 |
| `STORAGE_WRITE_FAILED` | Storage write failed | Yes | 500 |
| `STORAGE_NOT_FOUND` | Storage entry not found | No | 404 |
| `STORAGE_CORRUPT` | Storage data is corrupt | No | 500 |

### Sandbox Errors | Code | Description | Retryable | HTTP Status |
|------|-------------|-----------|-------------|
| `SANDBOX_CREATE_FAILED` | Failed to create sandbox | No | 500 |
| `SANDBOX_EXEC_FAILED` | Sandbox execution failed | No | 500 |
| `SANDBOX_TIMEOUT` | Sandbox execution timed out | Yes | 504 |
| `SANDBOX_RESOURCE_LIMIT_EXCEEDED` | Sandbox resource limit exceeded | No | 429 |

## Error Handling ### Retryable Errors

Some errors are marked as retryable, indicating that the operation might succeed if retried:

```go
if reachErr, ok := err.(*errors.ReachError); ok {
    if reachErr.Code.IsRetryable() {
        // Retry with exponential backoff
    }
}
```

### Error Categories Errors are organized by subsystem for filtering and monitoring:

```go
code := errors.CodeTimeout
category := code.Category() // Returns "execution"
```

### Creating Errors ```go
// Simple error
err := errors.New(errors.CodePolicyDenied, "operation not permitted")

// Error with cause
err := errors.Wrap(errors.CodeStorageReadFailed, err, "failed to read run data")

// Error with details
err := errors.Newf(errors.CodeInvalidArgument, "invalid parameter: %s", paramName)
```

## Best Practices 1. **Always use defined codes**: Don't create ad-hoc error strings
2. **Check retryability**: Respect the `IsRetryable()` flag for retry logic
3. **Include context**: Use `Wrap()` to add context while preserving the error chain
4. **Log properly**: Include error codes in logs for easier debugging
5. **Return appropriate HTTP status**: Map error codes to appropriate HTTP status codes

## Error Response Format API error responses follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "remediation": "Suggested fix (optional)"
}
```

## See Also - [Error Classification](services/runner/internal/errors/classify.go)
- [Error Formatting](services/runner/internal/errors/format.go)
- [ReachError Type](services/runner/internal/errors/reach_error.go)
