# Concurrency Safety Analysis

Last Updated: 2026-02-23

## Purpose

This document analyzes concurrency patterns in the Reach system,
identifying shared state access, synchronization mechanisms, and potential
race conditions.

---

## 1. Concurrency Architecture Overview

The Reach system has two concurrency domains:

1. **TypeScript (Node.js)**: Single-threaded event loop. Concurrency is
   cooperative (async/await). No shared mutable state races possible within
   a single process.

2. **Go (services/runner)**: Multi-goroutine server. Concurrency is
   preemptive. Shared mutable state requires explicit synchronization.

---

## 2. Go Concurrency Inventory

### Mutex Usage (sync.Mutex)

The runner service uses `sync.Mutex` in 19+ locations:

| Package        | Struct               | Field           | Purpose                    |
| :------------- | :------------------- | :-------------- | :------------------------- |
| telemetry      | PackTelemetry        | mu_global       | Global file access lock    |
| telemetry      | Logger               | mu              | Log buffer protection      |
| performance    | Optimizer            | mu              | Optimizer state            |
| mesh           | RateLimiter          | mu              | Rate limit counters        |
| mesh           | Transport            | mu, writeMu     | Connection + write guards  |
| mesh           | Handshake            | mu              | Handshake state            |
| mesh           | DelegationManager    | mu              | Delegation registry        |
| jobs           | DAGExecutor          | mu              | DAG execution state        |
| jobs           | Store                | SpendMu         | Budget spend tracking      |
| federation     | ReputationV2         | circuitMu       | Circuit breaker state      |
| federation     | Reputation           | mu              | Reputation scores          |
| backpressure   | Backpressure         | adjustmentMu    | Rate adjustments           |
| api            | Metrics              | mu              | Metrics counters           |
| api            | Registry             | mu              | Service registration       |
| api            | Consensus            | mu              | Consensus state            |
| gamification   | Gamification         | mu              | Achievement tracking       |
| agents         | Activity             | mu              | Agent activity tracking    |
| reach-serve    | main                 | rateLimitMu     | Request rate limiting      |

### RWMutex Usage (sync.RWMutex)

The runner uses `sync.RWMutex` in 50+ locations. Key patterns:

| Package      | Struct            | Purpose                           |
| :----------- | :---------------- | :-------------------------------- |
| storage      | Storage           | Database connection pool          |
| registry     | CapabilityStore   | Capability registration           |
| policy       | Gate              | Policy cache                      |
| performance  | Memory            | Memory tracking                   |
| packloader   | Sandbox, Loader   | Plugin loading and isolation      |
| mesh         | Peer, Router      | Peer management, routing tables   |
| historical   | Manager, Baseline | Historical data access            |
| determinism  | DriftMonitor      | Golden path tracking              |
| backpressure | Circuit           | Circuit breaker state             |
| api          | Server            | Metadata, autonomy, share state   |
| agents       | Registry          | Agent registration                |

### Goroutine Usage

11 identified goroutine spawn sites:

| Location                          | Pattern          | Risk Level |
| :-------------------------------- | :--------------- | :--------- |
| performance_test.go               | Test parallelism | LOW        |
| memory.go                         | Background GC    | LOW        |
| transport.go                      | Connection mgmt  | MEDIUM     |
| reputation_v2.go                  | Async reputation | MEDIUM     |
| determinism/stress_test.go        | Stress testing   | LOW        |
| backpressure/semaphore.go         | Semaphore impl   | LOW        |
| api/registry_test.go              | Test concurrency | LOW        |
| agents/runtime_test.go (×2)       | Test concurrency | LOW        |
| api/server.go                     | Request handling | MEDIUM     |
| agents/bridge.go                  | Batch processing | **HIGH**   |

---

## 3. Risk Analysis

### Risk 1: Batch Bridge Processing (HIGH)

**Location**: `services/runner/internal/agents/bridge.go:118`

```go
go func(idx int, br BatchRequest) {
    // Process batch request concurrently
}(idx, br)
```

**Risk**: Multiple goroutines processing batch requests concurrently. If
batch results are collected into a shared slice or map without
synchronization, ordering is nondeterministic.

**Impact**: Could affect determinism if batch results contribute to a hash
or decision output. The order in which results are collected depends on
goroutine scheduling.

**Mitigation needed**: Ensure results are collected into indexed positions
(not appended), or use a channel with deterministic drain ordering.

### Risk 2: DriftMonitor Race Window (MEDIUM)

**Location**: `services/runner/internal/determinism/drift.go`

The `DriftMonitor` uses `sync.RWMutex` correctly, but `CheckDrift` takes a
write lock (`mu.Lock()`) even though it could use a read lock for the
golden path lookup and only upgrade to write if drift is detected.

**Impact**: Performance, not correctness. Under high concurrency, all
drift checks serialize on the write lock.

**Recommendation**: Split into read-check + conditional write-upgrade.

### Risk 3: SQLite WAL Concurrent Writes (LOW)

**Location**: `src/go/sqlite.go`, `services/runner/internal/storage/storage.go`

SQLite WAL mode allows concurrent reads and a single writer. The Go SQLite
driver (`modernc.org/sqlite`) handles connection pooling internally.

**Risk**: If multiple goroutines attempt to write to the same database
simultaneously, SQLite will serialize them (SQLITE_BUSY). With WAL mode,
this is non-blocking for reads but can cause write contention.

**Current state**: The runner's storage layer uses `database/sql` which
manages a connection pool. Write operations are atomic SQL statements.
This is safe but could cause latency under high write load.

### Risk 4: Transport Double-Mutex (LOW)

**Location**: `services/runner/internal/mesh/transport.go`

The `Transport` struct has both `mu sync.Mutex` (line 104) and
`writeMu sync.Mutex` (line 105). Two mutexes on the same struct require
careful lock ordering to avoid deadlocks.

**Risk**: If `mu` and `writeMu` are ever acquired in different orders
across different code paths, a deadlock is possible.

**Recommendation**: Audit all call sites to verify consistent lock ordering.

---

## 4. TypeScript Concurrency

### Safety by Architecture

Node.js runs JavaScript in a single thread. The TypeScript components
(`src/core/`, `src/determinism/`, `src/lib/`, `src/cli/`) cannot have
data races on shared mutable state.

### Async Hazards

The only concurrency risk in TypeScript is async interleaving:

```typescript
// If two async operations modify the same state
const a = await loadContext();
// Another async operation could run here
await modifyContext(a);
```

**Current state**: The decision engine operations in `zeolite-core.ts` use
synchronous operations. The LLM provider calls are async but their results
are consumed sequentially, not concurrently.

**Risk**: LOW. No identified async interleaving hazards.

---

## 5. Database Transaction Safety

### SQLite (src/go/sqlite.go)

- WAL mode enabled for concurrent read access.
- Write operations are single SQL statements (atomic).
- No explicit `BEGIN/COMMIT` transaction blocks for compound operations.

### SQLite (services/runner/internal/storage/storage.go)

- Uses `database/sql` with connection pooling.
- Transactions are used for compound operations (migration application).
- Individual CRUD operations are single-statement atomic.

### Cross-Language Database Access

**Risk**: If both the Go runner and a TypeScript process access the same
SQLite database simultaneously, WAL mode prevents corruption but write
contention could cause SQLITE_BUSY errors.

**Current state**: The TypeScript layer and Go runner operate on different
databases. TypeScript uses the local `.zeo` store; Go uses the runner's
database. No cross-language concurrent access identified.

---

## 6. Formal Invariants

| ID     | Invariant                                           | Status     |
| :----- | :-------------------------------------------------- | :--------- |
| CON-01 | TypeScript is single-threaded (no data races)       | HOLDS      |
| CON-02 | Go shared state is mutex-protected                  | HOLDS      |
| CON-03 | SQLite WAL prevents corruption under concurrency    | HOLDS      |
| CON-04 | Batch processing preserves deterministic ordering   | **RISK**   |
| CON-05 | No cross-language concurrent database access        | HOLDS      |
| CON-06 | Lock ordering is consistent (no deadlock potential) | **UNVERIFIED** |

---

## 7. Pre-Existing Go Build Errors

The following Go compilation errors exist in `services/runner/` and are
pre-existing (not introduced by this audit):

| File                    | Error                            |
| :---------------------- | :------------------------------- |
| capability_cmd.go       | Unused imports (time, storage)   |
| demo_cmd.go             | Unused imports (determinism, storage) |
| historical_cmd.go       | Unused import (encoding/json)    |
| main.go:221,223,225     | Undefined: runVerifyPeer, runConsensus, runPeer |
| retention_cmd.go        | Unused import (encoding/json)    |
| consensus.go:575        | Syntax error                     |
| baseline.go             | Unused import (strings)          |
| drift_detector.go:608   | Undefined: strings               |
| evidence_diff.go        | Unused import (math), undefined: now |
| manager.go              | Unused import (errors), unused var: now |

These represent incomplete refactoring in the runner CLI and historical
analysis modules. They do not affect the TypeScript/core determinism
guarantees but must be resolved before the Go runner can be built.
