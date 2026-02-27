# Remote Replay Validation

**Status:** Optional / Disabled by Default  
**Architecture:** Client Stub

---

## Overview

Remote replay validation allows submitting execution proofs to an independent validator for replay verification.

**Important:** This feature is:
- **Disabled by default**
- **Optional** — execution proceeds regardless
- **Best-effort** — failures don't block execution
- **Stub implementation** — production requires actual validator service

---

## Purpose

1. **Independent Verification** — Third-party validation of execution correctness
2. **Audit Trail** — External record of execution
3. **Dispute Resolution** — Neutral party can verify claims
4. **Compliance** — Meet regulatory requirements for external validation

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Reach     │────▶│   Client     │────▶│   Remote        │
│   Node      │     │   Stub       │     │   Validator     │
│             │◀────│   (local)    │◀────│   (external)    │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │
                           │ HTTP/HTTPS
                           ▼
                    ┌──────────────┐
                    │   Retry/     │
                    │   Backoff    │
                    └──────────────┘
```

---

## Configuration

### Disabled (Default)

```bash
# Remote validation is disabled by default
reach proof validate-remote <bundle-id>
# Error: Remote validation is disabled
```

### Enable

```bash
# Enable remote validation
export REACH_REMOTE_VALIDATION=1
export REACH_REMOTE_ENDPOINT=https://validator.example.com/v1/validate
export REACH_REMOTE_API_KEY_REF=prod-api-key

# Optional configuration
export REACH_REMOTE_MAX_RETRIES=3
export REACH_REMOTE_TIMEOUT_MS=10000
export REACH_REMOTE_FAIL_ON_ERROR=false
```

### Programmatic

```typescript
import { enableRemoteValidation } from './src/remote/replay-client.js';

enableRemoteValidation('https://validator.example.com/v1/validate', {
  maxRetries: 3,
  timeoutMs: 10000,
  failOnError: false,
});
```

---

## Deterministic Request Envelope

To ensure the same request always produces the same envelope:

```typescript
interface ReplayRequestEnvelope {
  version: 'replay.v1';
  timestamp: string;
  bundleId: string;
  requestId: string;
  bundleCid: string;
  merkleRoot: string;
  engine: {
    type: string;
    version: string;
    protocolVersion: string;
    contractVersion: string;
  };
  inputHash: string;
  expectedOutputHash: string;
  algorithm: string;
}
```

All fields are:
- **Sorted alphabetically** — Deterministic JSON
- **Content-only** — No metadata that changes
- **Hashed identifiers** — No PII leakage

---

## Retry Strategy

Exponential backoff with jitter:

```
Attempt 1: Immediate
Attempt 2: Wait 1000ms
Attempt 3: Wait 2000ms
Attempt 4: Wait 4000ms
...
Max delay: 30000ms
```

Configuration:

```typescript
{
  maxRetries: 3,              // Maximum attempts
  initialRetryDelayMs: 1000,  // Initial delay
  maxRetryDelayMs: 30000,     // Maximum delay
  timeoutMs: 10000,           // Request timeout
}
```

---

## Validation Response

```typescript
interface ReplayValidationResponse {
  valid: boolean;
  timestamp: string;
  validatorId: string;
  computedOutputHash: string;
  match: boolean;
  executionDurationMs: number;
  error?: string;
}
```

---

## CLI Usage

```bash
# Submit for remote validation (must be enabled)
reach proof validate-remote <bundle-id>

# JSON output
reach proof validate-remote <bundle-id> --json
```

### Example Output

```
✅ Remote validation PASSED
   Validator: validator-001.reach.io
   Match: YES
   Duration: 145ms
```

### Failure Handling

```
❌ Remote validation FAILED
   Error: Connection timeout after 3 retries
   
⚠️  Note: Execution was not blocked (failOnError: false)
```

---

## Integration Points

### 1. Automatic Validation

```typescript
import { getRemoteReplayClient } from './src/remote/replay-client.js';

// After bundle creation
const bundle = createProofBundle({...});
const client = getRemoteReplayClient();

// Non-blocking validation
client.validate(bundle).then(result => {
  if (result.success) {
    console.log('Remote validation passed');
  } else {
    console.warn('Remote validation failed:', result.error);
  }
});
```

### 2. Manual Validation

```bash
# Create bundle
reach proof create req_abc123

# Submit for validation
reach proof validate-remote <bundle-id>
```

---

## Security Considerations

1. **No PII** — Envelope contains only hashes
2. **HTTPS only** — Validator endpoint must use TLS
3. **API key reference** — Key ID, not actual key
4. **Timeout** — Prevent blocking execution
5. **Fail open** — Don't block on validation failure

---

## Production Deployment

### Validator Service

You need to implement a validator service:

```typescript
// Validator service endpoint (pseudo-code)
app.post('/v1/validate', async (req, res) => {
  const envelope: ReplayRequestEnvelope = req.body;
  
  // 1. Verify envelope signature
  // 2. Load input from CAS by CID
  // 3. Re-execute with same engine version
  // 4. Compare output hash
  // 5. Return result
  
  const result = await replayAndValidate(envelope);
  
  res.json({
    valid: true,
    validatorId: 'validator-001',
    computedOutputHash: result.outputHash,
    match: result.match,
    executionDurationMs: result.duration,
  });
});
```

### CAS Requirements

Validator needs access to the same CAS:
- Same CIDs must resolve to same content
- Content must be immutable
- Validator must trust the CAS

---

## Monitoring

### Metrics

```
remote_validation_total
remote_validation_success
remote_validation_failure
remote_validation_retries
remote_validation_duration_ms
```

### Logs

```
[RemoteReplay] Submitting bundle abc123 for validation
[RemoteReplay] Attempt 1 failed, retrying in 1000ms: Connection refused
[RemoteReplay] Attempt 2 failed, retrying in 2000ms: Timeout
[RemoteReplay] Validation failed after 3 retries: Connection timeout
```

---

## Troubleshooting

### Issue: "Remote validation is disabled"

```bash
# Solution: Enable remote validation
export REACH_REMOTE_VALIDATION=1
export REACH_REMOTE_ENDPOINT=https://validator.example.com/v1/validate
```

### Issue: Connection failures

```bash
# Check endpoint
curl https://validator.example.com/v1/health

# Increase retries
timeoutMs: 30000
maxRetries: 5
```

### Issue: Validation timeout

```typescript
// Increase timeout
client.updateConfig({
  timeoutMs: 30000,
  maxRetryDelayMs: 60000,
});
```

---

## API Reference

### Client Methods

```typescript
class RemoteReplayClient {
  isEnabled(): boolean;
  validate(bundle: ProofBundle): Promise<ValidationResult>;
  updateConfig(config: Partial<RemoteValidationConfig>): void;
  getConfig(): RemoteValidationConfig;
}
```

### Utility Functions

```typescript
import { 
  enableRemoteValidation,
  disableRemoteValidation,
  getRemoteReplayClient,
} from './src/remote/replay-client.js';

// Enable
enableRemoteValidation('https://validator.example.com', {
  maxRetries: 3,
});

// Disable
disableRemoteValidation();

// Get client
const client = getRemoteReplayClient();
```

---

## Future Extensions

- **Multiple validators** — Consensus across validators
- **Validator staking** — Economic security
- **Fraud proofs** — Challenge invalid validations
- **Batch validation** — Submit multiple bundles
- **Offline validation** — Queue for later validation
