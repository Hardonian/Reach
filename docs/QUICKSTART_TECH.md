# Reach Quick Start Guide (Technical) ## Installation

### Prerequisites - Go 1.21+ (for building from source)
- Node.js 18+ (for TypeScript SDK)
- Python 3.8+ (for Python SDK)

### Install from Source ```bash
git clone https://github.com/reach/reach.git
cd reach
npm install
npm run build
```

### Install via Package Managers ```bash
# npm npm install -g @reach/cli

# pip pip install reach-sdk reach-cli
```

## API Usage ### OpenAPI Spec

The OpenAPI specification is available at:
- File: `openapi/reach.openapi.yaml`
- Endpoint: `GET /version` (returns spec version)

### cURL Examples ```bash
# Health check curl http://127.0.0.1:8787/health

# Create a run curl -X POST http://127.0.0.1:8787/runs \
  -H "Content-Type: application/json" \
  -d '{"capabilities":["tool.read"],"plan_tier":"free"}'

# Get run events curl http://127.0.0.1:8787/runs/{id}/events

# Stream events (SSE) curl -H "Accept: text/event-stream" \
  http://127.0.0.1:8787/runs/{id}/events
```

## SDK Examples ### TypeScript

```typescript
import { createReachClient } from '@reach/sdk';

const client = createReachClient({
  baseUrl: 'http://127.0.0.1:8787'
});

// Create a run
const run = await client.createRun({
  capabilities: ['tool.read', 'tool.write'],
  plan_tier: 'free'
});

// Stream events
const unsubscribe = await client.streamRunEvents(
  run.id,
  (event) => console.log('Event:', event),
  (error) => console.error('Error:', error)
);

// Cleanup
unsubscribe();
```

### Python ```python
from reach_sdk import create_client

client = create_client(base_url="http://127.0.0.1:8787")

# Create a run run = client.create_run(
    capabilities=["tool.read", "tool.write"],
    plan_tier="free"
)

# Get events events = client.get_run_events(run["id"])

# Stream events for event in client.stream_run_events(run["id"]):
    print(f"Event: {event['type']}")

# Create capsule capsule = client.create_capsule(run["id"])
```

## CLI Flags and JSON Mode ### Power Mode (Flags)

```bash
# JSON output everywhere reach federation status --json

# Quiet mode (errors only) reach doctor --quiet

# Verbose mode reach doctor --verbose

# Target remote server reach --base-url http://remote:8787 federation status
```

### Common Flags | Flag | Description |
|------|-------------|
| `--json` | Output JSON instead of formatted text |
| `--quiet` | Suppress non-error output |
| `--verbose` | Show detailed output |
| `--base-url` | Target a specific server |

## Error Codes | Code | HTTP | Description | Remediation |
|------|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Request body invalid | Check JSON syntax |
| `RUN_NOT_FOUND` | 404 | Run ID doesn't exist | Verify run ID |
| `CAPSULE_NOT_FOUND` | 404 | Capsule not found | Check file path |
| `PACK_NOT_FOUND` | 404 | Pack not in registry | Search for correct name |
| `INTERNAL_ERROR` | 500 | Server error | Check logs, retry |
| `TIMEOUT` | - | Request timed out | Increase timeout |
| `NETWORK_ERROR` | - | Connection failed | Check server status |

## CI Recipes ### GitHub Actions

```yaml
name: Reach Integration

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start Reach Server
        run: |
          docker run -d --name reach -p 8787:8787 reach/reach:latest
          sleep 5
          curl --retry 10 --retry-delay 1 http://127.0.0.1:8787/health

      - name: Run Tests
        run: |
          npm run test:integration

      - name: Cleanup
        if: always()
        run: docker stop reach
```

### Makefile ```makefile
REACH_URL ?= http://127.0.0.1:8787

reach-up:
	docker run -d --name reach -p 8787:8787 reach/reach:latest
	@sleep 2
	@curl -sf $(REACH_URL)/health || (echo "Reach failed to start"; exit 1)

reach-down:
	docker stop reach || true
	docker rm reach || true

test-integration: reach-up
	npm run test:integration
	$(MAKE) reach-down
```

## Troubleshooting ### Debug Mode

```bash
# Enable debug logging REACH_LOG_LEVEL=debug reach serve
```

### Check Server Status ```bash
# Full diagnostics reach doctor --verbose

# Check specific component reach doctor --check federation
reach doctor --check storage
```

### Database Inspection ```bash
# SQLite CLI sqlite3 data/reach.sqlite

# List tables .tables

# Check runs SELECT * FROM runs LIMIT 10;
```

## Performance Tuning ### Server Configuration

```bash
# Increase connection limits reach serve --max-connections 1000

# Enable compression reach serve --compress

# Tune for high throughput REACH_WORKERS=8 reach serve
```

### Client Configuration ```typescript
// Connection pooling
const client = createReachClient({
  baseUrl: 'http://127.0.0.1:8787',
  timeout: 60000,  // 60 second timeout
  keepAlive: true
});
```

## Security ### Local Development

```bash
# Bind to localhost only (default) reach serve --bind 127.0.0.1

# No auth in local mode ```

### Production ```bash
# Behind reverse proxy reach serve --bind 127.0.0.1 --trust-proxy

# Enable auth reach serve --auth-required --jwt-secret $JWT_SECRET
```

## Advanced Features ### Custom Middleware

```typescript
// Express middleware example
import { createReachClient } from '@reach/sdk';

const reach = createReachClient();

app.use('/api/reach', async (req, res, next) => {
  try {
    const health = await reach.health();
    req.reachStatus = health;
    next();
  } catch (error) {
    res.status(503).json({ error: 'Reach unavailable' });
  }
});
```

### Webhook Integration ```python
from fastapi import FastAPI
from reach_sdk import create_client

app = FastAPI()
reach = create_client()

@app.post("/webhook/run-completed")
async def on_run_completed(payload: dict):
    run_id = payload["run_id"]
    capsule = reach.create_capsule(run_id)
    # Archive capsule, send notification, etc.
    return {"status": "ok"}
```
