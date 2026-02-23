# Reach Configuration This document describes the configuration system for Reach.

## Configuration Resolution Order Configuration is resolved in the following order (highest priority last):

1. **Built-in defaults** - Sensible defaults for all settings
2. **Config file** - `~/.reach/config.json` or path from `REACH_CONFIG_PATH`
3. **Environment variables** - `REACH_*` variables override file settings

## Configuration File The configuration file is JSON format:

```json
{
  "execution": {
    "max_concurrent_runs": 10,
    "max_event_bytes": 104857600,
    "event_log_mode": "warn",
    "execution_timeout": "5m",
    "sandbox_enabled": true
  },
  "federation": {
    "enabled": true,
    "max_delegation_retries": 3,
    "delegation_retry_base_ms": 100,
    "delegation_retry_max_ms": 30000,
    "circuit_breaker_threshold": 5,
    "circuit_breaker_timeout": "30s",
    "handshake_ttl": "5m",
    "max_delegation_latency_ms": 5000
  },
  "policy": {
    "mode": "enforce",
    "allow_legacy_unsigned": false,
    "require_deterministic": false,
    "policy_path": ""
  },
  "registry": {
    "url": "https://registry.reach.dev",
    "cache_dir": "",
    "verify_signatures": true,
    "trusted_keys_path": ""
  },
  "telemetry": {
    "log_level": "info",
    "log_dir": "",
    "metrics_enabled": true,
    "metrics_path": "",
    "tracing_enabled": false
  },
  "security": {
    "secret_scanning_enabled": true,
    "max_secret_entropy": 4.5,
    "audit_log_path": ""
  },
  "determinism": {
    "strict_mode": false,
    "verify_on_load": true,
    "canonical_time_format": true
  }
}
```

## Environment Variables All configuration options can be set via environment variables:

### Execution | Variable | Description | Default |

|----------|-------------|---------|
| `REACH_MAX_CONCURRENT_RUNS` | Maximum concurrent executions (0 = unlimited) | 10 |
| `REACH_MAX_EVENT_BYTES` | Maximum event log size in bytes | 104857600 (100MB) |
| `REACH_EVENT_LOG_MODE` | Event log overflow mode: `warn` or `fail` | warn |
| `REACH_EXECUTION_TIMEOUT` | Default execution timeout | 5m |
| `REACH_SANDBOX_ENABLED` | Enable sandboxing | true |

### Federation | Variable | Description | Default |

|----------|-------------|---------|
| `REACH_FEDERATION_ENABLED` | Enable federation | true |
| `REACH_MAX_DELEGATION_RETRIES` | Max delegation retries | 3 |
| `REACH_DELEGATION_RETRY_BASE_MS` | Base retry delay in ms | 100 |
| `REACH_DELEGATION_RETRY_MAX_MS` | Max retry delay in ms | 30000 |
| `REACH_CIRCUIT_BREAKER_THRESHOLD` | Circuit breaker failure threshold | 5 |
| `REACH_CIRCUIT_BREAKER_TIMEOUT` | Circuit breaker timeout | 30s |
| `REACH_HANDSHAKE_TTL` | Handshake challenge TTL | 5m |
| `REACH_MAX_DELEGATION_LATENCY_MS` | Max delegation latency in ms | 5000 |

### Policy | Variable | Description | Default |

|----------|-------------|---------|
| `REACH_POLICY_MODE` | Policy mode: `enforce` or `warn` | enforce |
| `REACH_ALLOW_LEGACY_UNSIGNED_PACKS` | Allow legacy unsigned packs | false |
| `REACH_REQUIRE_DETERMINISTIC` | Require deterministic execution | false |
| `REACH_POLICY_PATH` | Path to policy files | (empty) |

### Registry | Variable | Description | Default |

|----------|-------------|---------|
| `REACH_REGISTRY_URL` | Registry URL | https://registry.reach.dev |
| `REACH_REGISTRY_CACHE_DIR` | Registry cache directory | (empty) |
| `REACH_REGISTRY_VERIFY_SIGNATURES` | Verify registry signatures | true |
| `REACH_TRUSTED_KEYS_PATH` | Path to trusted plugin keys | (empty) |

### Telemetry | Variable | Description | Default |

|----------|-------------|---------|
| `REACH_LOG_LEVEL` | Log level: `debug`, `info`, `warn`, `error`, `fatal` | info |
| `REACH_LOG_DIR` | Log directory | (empty) |
| `REACH_METRICS_ENABLED` | Enable metrics | true |
| `REACH_METRICS_PATH` | Metrics output path | (empty) |
| `REACH_TRACING_ENABLED` | Enable tracing | false |

### Security | Variable | Description | Default |

|----------|-------------|---------|
| `REACH_SECRET_SCANNING_ENABLED` | Enable secret scanning | true |
| `REACH_MAX_SECRET_ENTROPY` | Secret entropy threshold | 4.5 |
| `REACH_AUDIT_LOG_PATH` | Audit log path | (empty) |

### Determinism | Variable | Description | Default |

|----------|-------------|---------|
| `REACH_DETERMINISM_STRICT` | Strict determinism mode | false |
| `REACH_DETERMINISM_VERIFY_ON_LOAD` | Verify determinism on load | true |
| `REACH_DETERMINISM_CANONICAL_TIME` | Use canonical time format | true |

### General | Variable | Description |

|----------|-------------|
| `REACH_CONFIG_PATH` | Path to config file |

## Backpressure Configuration The following settings control backpressure and rate limiting:

### Max Concurrent Runs ```bash

REACH_MAX_CONCURRENT_RUNS=10

````

Limits the number of concurrent executions. When exceeded, new runs are queued or rejected based on configuration.

### Delegation Retries ```bash
REACH_MAX_DELEGATION_RETRIES=3
REACH_DELEGATION_RETRY_BASE_MS=100
REACH_DELEGATION_RETRY_MAX_MS=30000
````

Controls retry behavior for federation delegation:

- Retries use exponential backoff with jitter
- Base delay: 100ms
- Max delay: 30s
- Formula: `min(base * 2^attempt, max) + jitter`

### Circuit Breaker ```bash

REACH_CIRCUIT_BREAKER_THRESHOLD=5
REACH_CIRCUIT_BREAKER_TIMEOUT=30s

````

Circuit breaker settings:
- After 5 failures, circuit opens
- Circuit stays open for 30s
- Then transitions to half-open (allows test request)
- On success, circuit closes; on failure, reopens

### Event Log Limits ```bash
REACH_MAX_EVENT_BYTES=104857600
REACH_EVENT_LOG_MODE=warn
````

Controls event log size:

- `warn`: Log warning but continue
- `fail`: Fail the execution

## Validation Configuration is validated on load. Invalid configuration will fail fast with a descriptive error.

### Validation Rules - `max_concurrent_runs` >= 0

- `max_event_bytes` >= 0
- `event_log_mode` must be `warn` or `fail`
- `policy_mode` must be `enforce` or `warn`
- `log_level` must be `debug`, `info`, `warn`, `error`, or `fatal`
- `registry_url` must start with `http://` or `https://`
- `delegation_retry_max_ms` >= `delegation_retry_base_ms`
- `circuit_breaker_threshold` >= 1
- All timeout values > 0

## Security Considerations ### Secret Handling

- Configuration values are redacted in logs
- Never log `REACH_*` variables directly
- Use absolute paths for sensitive file locations

### Policy Mode - `enforce`: Deny operations that violate policy (production)

- `warn`: Log violations but allow (development)

Default is `enforce` when `CI` or `GO_ENV=production` is set.

## Example Configurations ### Development

```bash
export REACH_POLICY_MODE=warn
export REACH_ALLOW_LEGACY_UNSIGNED_PACKS=true
export REACH_LOG_LEVEL=debug
export REACH_SANDBOX_ENABLED=false
```

### Production ```bash

export REACH_POLICY_MODE=enforce
export REACH_REQUIRE_DETERMINISTIC=true
export REACH_LOG_LEVEL=warn
export REACH_MAX_CONCURRENT_RUNS=50
export REACH_CIRCUIT_BREAKER_THRESHOLD=3

````

### High-Availability Federation ```bash
export REACH_FEDERATION_ENABLED=true
export REACH_MAX_DELEGATION_RETRIES=5
export REACH_CIRCUIT_BREAKER_THRESHOLD=10
export REACH_CIRCUIT_BREAKER_TIMEOUT=60s
export REACH_MAX_DELEGATION_LATENCY_MS=10000
````
