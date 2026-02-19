# Reach Architecture

This document describes the high-level architecture of Reach, including module boundaries, data flow, and key design decisions.

## Overview

Reach is a deterministic execution fabric for AI systems. It provides:
- **Deterministic Workflow Execution**: Guaranteed reproducible AI workflow runs
- **Policy Enforcement**: Runtime policy checking and governance
- **Multi-tenant Isolation**: Secure separation between organizations
- **Federation**: Distributed execution across nodes
- **Observability**: Comprehensive logging, metrics, and audit trails

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Web UI  │  │  Mobile  │  │  VS Code │  │   CLI    │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                      API Gateway Layer                           │
│                    ┌───────┴───────┐                            │
│                    │  Runner API   │                            │
│                    │  - Rate Limit │                            │
│                    │  - Auth       │                            │
│                    │  - Routing    │                            │
│                    └───────┬───────┘                            │
└────────────────────────────┼────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│   Core Services │  │  Policy Engine  │  │   Federation   │
│  ┌──────────┐  │  │  ┌──────────┐   │  │  ┌──────────┐  │
│  │ Job Queue│  │  │  │  Gates   │   │  │  │ Nodes    │  │
│  │ Scheduler│  │  │  │ Policies │   │  │  │ Discovery│  │
│  └──────────┘  │  │  └──────────┘   │  │  └──────────┘  │
│  ┌──────────┐  │  └─────────────────┘  └────────────────┘
│  │Execution │  │
│  │ Engine   │  │
│  └──────────┘  │
└────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  SQLite  │  │  Events  │  │  Audit   │  │  State   │        │
│  │   Store  │  │   Log    │  │   Log    │  │  Store   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## Module Boundaries

### 1. Runner Service (`services/runner/`)

The main orchestration service. Monolithic but with clear internal boundaries.

#### Internal Packages

| Package | Purpose | Dependencies |
|---------|---------|--------------|
| `api/` | HTTP handlers, routing, middleware | `storage`, `jobs`, `federation` |
| `storage/` | SQLite persistence layer | None (data layer) |
| `jobs/` | Job queue management | `storage` |
| `federation/` | Node discovery and delegation | `storage` |
| `policy/` | Policy evaluation and gates | `storage` |
| `autonomous/` | Autonomous agent orchestration | `jobs`, `storage` |
| `adaptive/` | Runtime strategy adaptation | `config`, `model` |
| `backpressure/` | Rate limiting, semaphores | `errors` |
| `determinism/` | Deterministic execution archive | `storage` |
| `engineclient/` | Communication with Rust engine | None |
| `errors/` | Error classification and handling | None |
| `mesh/` | Node mesh networking | `config` |
| `model/` | LLM adapter management | None |
| `performance/` | Memory management, optimization | None |
| `plugins/` | Plugin verification | None |
| `spec/` | Protocol version compatibility | None |
| `telemetry/` | Logging, metrics, tracing | None |

**Key Rule**: `storage/` is the data layer - no package should bypass it to access the database.

### 2. Engine (`crates/engine/`)

Rust-based deterministic execution engine.

**Responsibilities:**
- Workflow compilation
- Deterministic state machine execution
- Event generation
- Action scheduling

**Interface:** JSON over stdin/stdout (via `engineclient/`)

### 3. SDKs (`sdk/`)

Client libraries for interacting with Reach.

- `ts/` - TypeScript/JavaScript SDK
- `python/` - Python SDK

### 4. Mobile (`mobile/`)

Native mobile SDKs.

- `android/` - Android SDK (Kotlin/Java)
- `ios/` - iOS SDK (Swift)

### 5. Web (`apps/arcade/`)

Next.js-based web application.

### 6. Protocol (`protocol/`, `spec/`)

Protocol definitions and specifications.

## Data Flow

### Workflow Execution Flow

```
1. Client → POST /v1/runs
   └─ Creates run record, initializes workflow

2. Runner → engineclient.CompileWorkflow()
   └─ Sends workflow to Rust engine for compilation

3. Runner → engineclient.StartRun()
   └─ Gets initial action from engine

4. Runner schedules job → jobs.DurableQueue
   └─ Job queued for execution

5. Worker polls → jobs.LeaseReadyJobs()
   └─ Claims job lease

6. Worker → engineclient.NextAction()
   └─ Gets next action from engine

7. If tool call required:
   a. Worker executes tool
   b. Worker → engineclient.ApplyToolResult()
   c. Engine returns next action

8. Repeat 6-7 until workflow complete

9. Worker → CompleteJob()
   └─ Marks job as complete, stores result
```

### Event Flow

```
Engine generates event
    ↓
Runner receives event
    ↓
Event stored in SQLite (events table)
    ↓
Event broadcast to subscribers
    ↓
Clients receive via SSE / WebSocket / polling
```

### Audit Flow

```
Policy decision / Tool execution / Security event
    ↓
Audit record created
    ↓
Stored in SQLite (audit table)
    ↓
Available via GET /v1/runs/{id}/audit
```

## Database Schema

### Core Tables

**runs** - Workflow execution records
```sql
CREATE TABLE runs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    capabilities TEXT,  -- JSON array
    status TEXT,
    created_at DATETIME
);
```

**events** - Execution events
```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    type TEXT,
    payload BLOB,  -- JSON
    created_at DATETIME
);
```

**jobs** - Job queue
```sql
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    run_id TEXT,
    status TEXT,  -- queued, leased, completed, dead_letter
    lease_token TEXT,
    priority INTEGER,
    attempts INTEGER,
    max_attempts INTEGER,
    next_run_at DATETIME,
    -- ... other fields
);
```

**audit** - Audit trail
```sql
CREATE TABLE audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT,
    run_id TEXT,
    type TEXT,
    payload BLOB,  -- JSON
    created_at DATETIME
);
```

**nodes** - Federation node registry
```sql
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    type TEXT,
    capabilities TEXT,  -- JSON
    status TEXT,
    last_heartbeat_at DATETIME,
    latency_ms INTEGER,
    load_score INTEGER
);
```

## Key Design Decisions

### 1. SQLite for Single-Node Deployments

**Rationale:**
- Zero configuration
- ACID transactions
- Good enough for single-node deployments
- Easy backups (single file)

**Trade-offs:**
- Limited write concurrency
- Single-node only (by design)
- For multi-node, use federation

### 2. Deterministic Engine in Rust

**Rationale:**
- Rust provides memory safety without GC pauses
- Deterministic execution requires careful control over:
  - Random number generation
  - Time sources
  - External I/O
- Separation from Go runtime reduces interference

### 3. Job Queue in Database

**Rationale:**
- Same persistence as data (transactions)
- Simple recovery (replay from DB)
- No external dependencies

**Trade-offs:**
- Less throughput than dedicated queue
- Polling vs. pub/sub

### 4. Per-Tenant Rate Limiting

**Implementation:**
- Token bucket per tenant
- Separate limits per IP for unauthenticated
- Burst capacity for handling spikes

**Configuration:**
```go
RateLimitConfig{
    RequestsPerMinutePerTenant: 120,
    RequestsPerMinutePerIP:     60,
    BurstSizePerTenant:         20,
    BurstSizePerIP:             10,
}
```

### 5. Policy Engine

**Architecture:**
- Policies defined as code + configuration
- Gates evaluated at runtime
- Async audit logging

**Types:**
- Allow/Deny gates
- Rate limit gates
- Human approval gates

## Security Model

### Authentication

- Development: Simple token-based
- Production: JWT with OIDC
- Mobile: Challenge-response with Ed25519

### Authorization

- Tenant isolation at database level (tenant_id column)
- Capability-based access control
- Policy gates for sensitive operations

### Audit

- All policy decisions logged
- Tool executions logged with inputs/outputs
- Immutable audit trail

## Scaling Strategy

### Vertical Scaling

- Single node handles high load
- SQLite with WAL mode
- Connection pooling

### Horizontal Scaling (Federation)

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Node 1  │◄───►│  Node 2  │◄───►│  Node 3  │
│  (us-east)│     │ (eu-west)│     │(ap-south)│
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     └────────────────┼────────────────┘
                      │
              ┌───────▼────────┐
              │  Control Plane │
              │  (coordination) │
              └────────────────┘
```

**Mechanism:**
- Nodes register in shared database
- Heartbeats for health
- Delegation decisions based on:
  - Node capabilities
  - Geographic proximity
  - Load scores
  - Reputation

## Development Guidelines

### Adding New Endpoints

1. Add handler in `api/server.go`
2. Apply middleware:
   - `requireAuth` for authenticated
   - `withRateLimit` for rate limited
   - `withObservability` for all
3. Add tests in `api/server_test.go`
4. Update OpenAPI spec

### Database Migrations

1. Add SQL file to `storage/migrations/`
2. Name: `NNN_description.sql`
3. Automatic migration on startup

### Error Handling

Always use error classification:
```go
return errors.New(errors.CodeInvalidInput, "message")
```

Never:
```go
return fmt.Errorf("something went wrong")  // ❌
```

## Testing Strategy

### Unit Tests

- Every package has `_test.go` files
- Mock external dependencies
- Use `t.TempDir()` for filesystem tests

### Integration Tests

- Test full API flows
- Use test database
- Cleanup after each test

### Load Tests

- Use `tests/load/` scenarios
- Run against staging environment
- Validate rate limiting under load

## Deployment

### Docker

```bash
docker-compose up -d runner
```

### Kubernetes

```bash
kubectl apply -f k8s/
```

### Configuration

Priority (highest to lowest):
1. Environment variables (`REACH_*`)
2. Config file (`config.json`)
3. Defaults

See `config/config.go` for all options.

## Monitoring

### Metrics

- Prometheus endpoint: `/metrics`
- Custom metrics defined in `telemetry/metrics.go`
- Key metrics:
  - Request latency (p50, p95, p99)
  - Job queue depth
  - Active runs
  - Error rates

### Logging

- Structured JSON logging
- Correlation IDs
- Sensitive data redaction

### Alerting

- High error rate
- Queue depth growing
- Node heartbeats missing

## Future Considerations

1. **Multi-database support**: PostgreSQL for large deployments
2. **Streaming**: WebSocket for real-time events
3. **Caching**: Redis for session/cache layer
4. **GraphQL**: Alternative to REST API
5. **WebAssembly**: Plugin system using WASM
