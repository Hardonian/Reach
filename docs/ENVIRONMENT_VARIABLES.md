# Environment Variables Reference

Complete reference for all Reach environment variables.

---

## Quick Reference Table

| Variable                    | Description                | Default                 | Required |
| --------------------------- | -------------------------- | ----------------------- | -------- |
| `REACH_DATA_DIR`            | Data directory path        | `./data`                | No       |
| `REACH_BASE_URL`            | API base URL               | `http://127.0.0.1:8787` | No       |
| `REACH_LOG_LEVEL`           | Logging level              | `info`                  | No       |
| `REACH_RETENTION_DAYS`      | Days to retain replay data | `7`                     | No       |
| `REACH_COMPACTION_ENABLED`  | Enable data compaction     | `true`                  | No       |
| `REACH_SESSION_COOKIE_NAME` | Session cookie name        | `reach_session`         | No       |
| `REACH_SESSION_TTL_HOURS`   | Session TTL in hours       | `24`                    | No       |

---

## Arcade / Cloud Variables

| Variable                                 | Description                                             | Default                      |
| ---------------------------------------- | ------------------------------------------------------- | ---------------------------- |
| `REACH_CLOUD_ENABLED`                    | Enables multi-tenant cloud routes and DB-backed APIs    | `false`                      |
| `CLOUD_DB_PATH`                          | SQLite path for cloud control-plane data                | `./reach-cloud.db`           |
| `READYLAYER_BASE_URL`                    | Base URL used in report/replay links                    | `https://app.readylayer.com` |
| `NEXT_PUBLIC_BASE_URL`                   | Public app canonical URL for metadata/sitemaps          | `http://127.0.0.1:3000`      |
| `NEXT_PUBLIC_APP_URL`                    | App URL used by auth email links                        | `http://127.0.0.1:3000`      |
| `REACH_RUNNER_URL`                       | Runner execution endpoint for workflow simulations      | `http://127.0.0.1:8080`      |
| `READYLAYER_ALERT_EMAIL_ENDPOINT`        | HTTP endpoint for alert email relay                     | unset                        |
| `READYLAYER_ALERT_EMAIL_API_KEY`         | API key for alert relay                                 | unset                        |
| `READYLAYER_ALERT_EMAIL_FROM`            | Sender address for alert relay payloads                 | unset                        |
| `SMTP_HOST`                              | Direct SMTP host (used when no relay endpoint is set)   | unset                        |
| `SMTP_PORT`                              | Direct SMTP port                                        | `587`                        |
| `SMTP_USER`                              | Direct SMTP auth username                               | unset                        |
| `SMTP_PASS`                              | Direct SMTP auth password                               | unset                        |
| `READYLAYER_ALERT_DEDUPE_WINDOW_SECONDS` | Alert dedupe window in seconds                          | `300`                        |
| `READYLAYER_STRICT_MODE`                 | Enables strict governance mode (warnings can block)     | `false`                      |
| `READYLAYER_GATE_WARNINGS_BLOCK`         | Whether warnings contribute to gate failures            | `false`                      |
| `READYLAYER_GATE_MAX_WARNINGS`           | Warning threshold when warning blocking is enabled      | `25`                         |
| `DECISION_ENGINE`                        | Decision backend selection (`js`, `wasm`, future modes) | `js`                         |

---

## Core Variables

### `REACH_DATA_DIR`

Specifies where Reach stores its data, including replay logs, decision history, and state files.

```bash
# Linux/macOS
export REACH_DATA_DIR=/var/lib/reach

# Windows (PowerShell)
$env:REACH_DATA_DIR = "C:\ProgramData\Reach"

# Relative path
export REACH_DATA_DIR=./my-data
```

**Notes:**

- Directory is created automatically if it doesn't exist
- Ensure the process has write permissions
- Use absolute paths in production

---

### `REACH_BASE_URL`

The base URL for Reach API endpoints.

```bash
# Local development (default)
export REACH_BASE_URL=http://127.0.0.1:8787

# Docker
export REACH_BASE_URL=http://localhost:8787

# Production with reverse proxy
export REACH_BASE_URL=https://reach-api.example.com
```

**Notes:**

- Must match the `--port` flag if using non-default port
- No trailing slash

---

### `REACH_LOG_LEVEL`

Controls the verbosity of logging output.

```bash
# Debug (verbose, includes internal state)
export REACH_LOG_LEVEL=debug

# Info (default, operational messages)
export REACH_LOG_LEVEL=info

# Warn (warnings and errors only)
export REACH_LOG_LEVEL=warn

# Error (errors only)
export REACH_LOG_LEVEL=error
```

**Notes:**

- Use `debug` for troubleshooting
- Use `error` in production for reduced noise

---

## Data Management

### `REACH_RETENTION_DAYS`

Number of days to retain replay and decision data before automatic cleanup.

```bash
# Keep data for 30 days
export REACH_RETENTION_DAYS=30

# Disable automatic cleanup (not recommended)
export REACH_RETENTION_DAYS=0
```

**Notes:**

- Set to `0` to disable automatic cleanup
- Manual cleanup still possible via `reach compact`

---

### `REACH_COMPACTION_ENABLED`

Whether to enable automatic compaction of old data.

```bash
# Enable compaction (default)
export REACH_COMPACTION_ENABLED=true

# Disable compaction
export REACH_COMPACTION_ENABLED=false
```

**Notes:**

- Compaction reduces storage usage
- May impact performance during compaction runs
- Disable only for debugging

---

## Session Configuration

### `REACH_SESSION_COOKIE_NAME`

Name of the session cookie used for authentication.

```bash
# Custom cookie name
export REACH_SESSION_COOKIE_NAME=my_app_session
```

**Notes:**

- Change for multi-tenant deployments
- Must be unique per domain

---

### `REACH_SESSION_TTL_HOURS`

Time-to-live for sessions in hours.

```bash
# Short sessions (1 hour)
export REACH_SESSION_TTL_HOURS=1

# Long sessions (30 days)
export REACH_SESSION_TTL_HOURS=720
```

**Notes:**

- Shorter TTL = more secure
- Longer TTL = better UX
- Balance based on your security requirements

---

## Development Variables

### `REACH_DEMO_MODE`

Enable demo mode for consistent output (frozen timestamps, deterministic random).

```bash
# Enable demo mode
export REACH_DEMO_MODE=1

# Disable (default)
unset REACH_DEMO_MODE
```

**Notes:**

- Only for demonstrations and screenshots
- Do not use in production

---

### `REACH_ALLOW_UNSIGNED`

Allow running unsigned packs (development only).

```bash
# Allow unsigned (dev only!)
export REACH_ALLOW_UNSIGNED=true
```

**Warnings:**

- ⚠️ **Security risk**: Only use in development
- Production packs should always be signed

---

### `REACH_FROZEN_TIME`

Freeze time to a specific timestamp for reproducible demos.

```bash
# Freeze to specific time
export REACH_FROZEN_TIME=2026-02-23T12:00:00Z
```

**Notes:**

- Only affects `time.Now()` calls in demo mode
- Useful for screenshots and documentation

---

## Federation (Advanced)

### `FEDERATION_NODE_ID`

Unique identifier for this node in a federation.

```bash
export FEDERATION_NODE_ID=node-us-east-1
```

---

### `FEDERATION_PEERS`

Comma-separated list of peer node URLs.

```bash
export FEDERATION_PEERS=https://node1.example.com,https://node2.example.com
```

---

### `FEDERATION_INSECURE_SKIP_VERIFY`

Skip TLS certificate verification (development only).

```bash
# Insecure - dev only!
export FEDERATION_INSECURE_SKIP_VERIFY=true
```

**Warnings:**

- ⚠️ **Major security risk**
- Never use in production
- Only for testing with self-signed certs

---

## Configuration File

Environment variables can also be set in a config file:

**`~/.reach/config.yaml`:**

```yaml
server:
  port: 8787
  bind: 127.0.0.1

data:
  directory: ~/.reach/data
  retention_days: 30
  compaction_enabled: true

logging:
  level: info
  format: json

session:
  cookie_name: reach_session
  ttl_hours: 24
```

**Precedence:**

1. Command-line flags (highest)
2. Environment variables
3. Config file
4. Default values (lowest)

---

## Docker Configuration

When running in Docker, pass variables with `-e`:

```bash
docker run -p 8787:8787 \
  -e REACH_LOG_LEVEL=debug \
  -e REACH_DATA_DIR=/data \
  -v reach-data:/data \
  reach/reach:latest
```

Or use an env file:

```bash
# .env
docker run --env-file .env -p 8787:8787 reach/reach:latest
```

---

## Troubleshooting

### Check Current Values

```bash
# View all Reach env vars
env | grep REACH

# Check specific variable
echo $REACH_DATA_DIR
```

### Common Issues

**Issue:** `Permission denied` on data directory

```bash
# Fix ownership
sudo chown -R $(whoami) $REACH_DATA_DIR
```

**Issue:** Changes not taking effect

```bash
# Ensure variable is exported
export REACH_LOG_LEVEL=debug

# Or source your shell config
source ~/.bashrc
```

---

## See Also

- [Installation Guide](INSTALL.md) - Setup instructions
- [Configuration as Code](config-as-code.md) - Advanced configuration
- [Troubleshooting](troubleshooting/common-failures.md) - Common issues
