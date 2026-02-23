# Reach Error Code Registry

This document defines the standardized error codes for the Reach protocol.

## Error Structure

All errors returned by Reach CLI and services follow this structured format:

```json
{
  "code": "RL-XXXX",
  "category": "PolicyFailure | StorageError | DeterminismError | CloudDisabled",
  "message": "...",
  "suggestion": "...",
  "deterministic": true|false
}
```

## Global Error Codes

| Code    | Category    | Name                  | Description                                      |
| ------- | ----------- | --------------------- | ------------------------------------------------ |
| RL-0001 | general     | CodeUnknown           | An unexpected internal error.                    |
| RL-0002 | general     | CodeInternal          | Internal system failure.                         |
| RL-1001 | policy      | CodePolicyDenied      | Execution denied by policy contract.             |
| RL-2001 | determinism | CodeReplayMismatch    | Replay hash does not match original fingerprint. |
| RL-3001 | storage     | CodeStorageReadFailed | Failed to read from local execution data.        |
| RL-4001 | cloud       | CodeCloudDisabled     | Cloud-only feature requested in OSS mode.        |

## Subsystem Codes

### Policy (RL-1xxx)

- **RL-1001**: `POLICY_DENIED` - The policy engine rejected the request.
- **RL-1002**: `POLICY_INVALID_SIGNATURE` - The pack or run signature is invalid.
- **RL-1003**: `POLICY_DETERMINISM_REQUIRED` - Replay failed to verify determinism.

### Determinism (RL-2xxx)

- **RL-2001**: `REPLAY_MISMATCH` - The replayed event log produced a different hash.
- **RL-2002**: `NONDETERMINISTIC_INPUT` - Input contains unstable fields (e.g., timestamps).

### Storage (RL-3xxx)

- **RL-3001**: `STORAGE_READ_FAILED` - Disk I/O error during read.
- **RL-3002**: `STORAGE_CORRUPT` - JSON parity check failed on load.

### Cloud (RL-4xxx)

- **RL-4001**: `CLOUD_DISABLED` - Feature requires Reach Cloud adapter.
- **RL-4002**: `CLOUD_AUTH_REQUIRED` - Invalid or missing cloud credentials.

## Determinism Policy

Errors marked as `deterministic: true` must produce the same error code and message given the same inputs and state. This is critical for Execution Proof (Proof of Execution Evidence).
