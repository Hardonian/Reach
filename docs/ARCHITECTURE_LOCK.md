# Architecture Lock — Structural Classification

> **Audit Date**: 2026-02-22
> **Scope**: Full repository classification of every significant module
> **Status**: LOCKED — Changes require Architecture Agent approval

---

## Table of Contents

1. [OSS Core Inventory](#1-oss-core-inventory)
2. [Adapter Interface Inventory](#2-adapter-interface-inventory)
3. [Cloud Stub Inventory](#3-cloud-stub-inventory)
4. [Dead Code Candidates](#4-dead-code-candidates)
5. [Security Surface Map](#5-security-surface-map)
6. [Module Dependency Graph](#6-module-dependency-graph)
7. [Boundary Violations Found](#7-boundary-violations-found)

---

## 1. OSS Core Inventory

These modules form the deterministic, offline-capable heart of Reach. They MUST remain free of cloud dependencies.

### 1.1 Rust Engine (`crates/`)

| Module | Path | Description |
|--------|------|-------------|
| `engine-core` | `crates/engine-core/` | Deterministic invariants, replay state, signed pack verification, canonical FNV-1a hashing, semver compatibility checks |
| `engine` | `crates/engine/` | Workflow execution engine — state machine, policy evaluation, tool dispatch, budget tracking, capsule manifests, artifact patching |
| `ffi/c_abi` | `crates/ffi/c_abi/` | C ABI foreign function interface for `engine` — exposes `reach_engine_create`, `reach_start_run`, `reach_next_action`, etc. |
| `ffi/uniffi` | `crates/ffi/uniffi/` | UniFFI bindings for `engine` — Kotlin/Swift interop via `create_engine`, `start_run`, `next_action`, `apply_tool_result` |

**Key files**:
- [`lib.rs`](crates/engine/src/lib.rs) — Engine, RunHandle, Action, ExecutionControls, BudgetTracker
- [`state_machine.rs`](crates/engine/src/state_machine.rs) — WorkflowMachine, MachineState, step/pause/resume/cancel
- [`ir.rs`](crates/engine/src/ir.rs) — Workflow graph IR (nodes, edges, validation)
- [`policy/mod.rs`](crates/engine/src/policy/mod.rs) — Capability, Policy, ExecutionPolicy, PolicyError
- [`state/mod.rs`](crates/engine/src/state/mod.rs) — RunStatus, RunEvent, state transitions
- [`capsule.rs`](crates/engine/src/capsule.rs) — CapsuleManifest (deterministic)
- [`events.rs`](crates/engine/src/events.rs) — EngineEvent, EventKind
- [`artifacts/mod.rs`](crates/engine/src/artifacts/mod.rs) — Diff, Patch
- [`tools/mod.rs`](crates/engine/src/tools/mod.rs) — ToolSpec, ToolCall, ToolResult
- [`workflow/mod.rs`](crates/engine/src/workflow/mod.rs) — Workflow, Step, StepKind
- [`invariants/mod.rs`](crates/engine-core/src/invariants/mod.rs) — canonical_hash, replay verification, pack signature verification, version compatibility

### 1.2 Go Evaluation Engine (`core/`)

| Module | Path | Description |
|--------|------|-------------|
| `evaluation` | `core/evaluation/` | Scoring pipeline — grounding validation, policy compliance, tool use validation, latency/token scoring, trend analysis, regression detection |
| `federation` | `core/federation/` | Federation contract types — CapabilityContract, FederationState, PeerInfo, ContractManager |

**Key files**:
- [`engine.go`](core/evaluation/engine.go) — Evaluator, ScoreRun, ComputeTrend, CheckRegression
- [`schema.go`](core/evaluation/schema.go) — TestDefinition, ScoringResult, ScoringWeights, RegressionThresholds, Feedback, TrendReport
- [`analytics.go`](core/evaluation/analytics.go) — RetrievalMetrics, AnalyticsModule (RAG analytics)
- [`contract.go`](core/federation/contract.go) — CapabilityContract, PeerInfo

### 1.3 Runner Service (`services/runner/`)

| Module | Path | Description |
|--------|------|-------------|
| `reach-serve` | `services/runner/cmd/reach-serve/` | HTTP server for local/hosted runs |
| `reach-eval` | `services/runner/cmd/reach-eval/` | CLI evaluation runner |
| `runner-mcp` | `services/runner/cmd/runner-mcp/` | MCP server bridge |
| `agents` | `services/runner/internal/agents/` | Agent runtime, planner, registry, bridge, contracts |
| `autonomous` | `services/runner/internal/autonomous/` | Autonomous orchestration, pack execution, planning, routing |
| `backpressure` | `services/runner/internal/backpressure/` | Rate limiting, circuit breakers, retry, semaphore |
| `config` | `services/runner/internal/config/` | Configuration schema and validation |
| `contextkeys` | `services/runner/internal/contextkeys/` | Typed context keys for request scoping |
| `determinism` | `services/runner/internal/determinism/` | Determinism verification, archive, diff, drift detection |
| `engineclient` | `services/runner/internal/engineclient/` | Client for Rust engine |
| `errors` | `services/runner/internal/errors/` | Error codes, classification, formatting |
| `federation` | `services/runner/internal/federation/` | Attestation, coordinator, delegation, identity, reputation |
| `invariants` | `services/runner/internal/invariants/` | Core invariant guards |
| `jobs` | `services/runner/internal/jobs/` | Job queue, DAG executor, budget, branching, event schema |
| `mcpserver` | `services/runner/internal/mcpserver/` | MCP protocol server, audit, policy, transport |
| `mesh` | `services/runner/internal/mesh/` | Mesh networking — node, peer, router, handshake, identity, discovery, sync, transport, correlation, rate limiting |
| `model` | `services/runner/internal/model/` | LLM adapter abstraction — adapter, factory, hosted, local, small, provider, future |
| `pack` | `services/runner/internal/pack/` | Pack validation, linting, merkle tree, scoring, docs |
| `packloader` | `services/runner/internal/packloader/` | Pack loading, manifest parsing, lockfile, sandbox, containment, version, injection |
| `performance` | `services/runner/internal/performance/` | Memory optimization, performance optimizer |
| `plugins` | `services/runner/internal/plugins/` | Plugin signature verification |
| `poee` | `services/runner/internal/poee/` | Policy Orchestration Execution Engine, mesh integration |
| `policy` | `services/runner/internal/policy/` | Policy gate evaluation |
| `registry` | `services/runner/internal/registry/` | Capability registry, graph, pack registry, reputation |
| `sandbox` | `services/runner/internal/sandbox/` | Execution sandbox |
| `spec` | `services/runner/internal/spec/` | Spec version validation |
| `storage` | `services/runner/internal/storage/` | SQLite storage with migrations |
| `support` | `services/runner/internal/support/` | Support bot |
| `telemetry` | `services/runner/internal/telemetry/` | Logger, metrics, tracing, pack telemetry |
| `workspace` | `services/runner/internal/workspace/` | Workspace and runner management |
| `arcade/gamification` | `services/runner/internal/arcade/gamification/` | Gamification and achievement system |
| `audit` | `services/runner/internal/audit/` | Receipt-based audit trail |

### 1.4 Pack DevKit (`pack-devkit/`)

| Module | Path | Description |
|--------|------|-------------|
| `harness` | `pack-devkit/harness/` | Test harness, linter, doctor, publisher, registry validator, scoring, docs generator |
| `templates` | `pack-devkit/templates/` | Pack templates (governed-minimal, governed-with-policy, governed-with-replay-tests, federation-aware) |
| `fixtures` | `pack-devkit/fixtures/` | Test fixtures (hello-deterministic, policy-denial, replay-verification) |

### 1.5 Internal PackKit (`internal/packkit/`)

| Module | Path | Description |
|--------|------|-------------|
| `config` | `internal/packkit/config/` | Pack configuration |
| `lockfile` | `internal/packkit/lockfile/` | Lockfile parsing and validation |
| `manifest` | `internal/packkit/manifest/` | Manifest parsing |
| `registry` | `internal/packkit/registry/` | Registry index management with golden tests |
| `resolver` | `internal/packkit/resolver/` | Dependency resolution |
| `signing` | `internal/packkit/signing/` | Ed25519 manifest signature verification |

### 1.6 Protocol Schemas (`protocol/`)

| Module | Path | Description |
|--------|------|-------------|
| `v1` | `protocol/v1/` | V1 JSON schemas (capsule, connector, event, execution-contract, marketplace, session, spawn) |
| `schemas` | `protocol/schemas/` | Core schemas (agent-contract, artifact, events, orchestration-plan, toolcall, etc.) |
| `ide` | `protocol/ide/` | IDE bridge schemas (apply_patch, approval_request, context, notification) |
| `integrations` | `protocol/integrations/` | Integration schemas (manifests, webhooks, OAuth) |
| `plugins` | `protocol/plugins/` | Plugin manifest schema |
| `examples` | `protocol/examples/` | Protocol examples (capsule_sync, guardrail_stop, marketplace, run events, bundles) |

### 1.7 SDKs (`sdk/`)

| Module | Path | Description |
|--------|------|-------------|
| `python` | `sdk/python/` | Python SDK — ReachClient, types, exceptions |
| `ts` | `sdk/ts/` | TypeScript SDK — client library |

### 1.8 Mobile SDKs

| Module | Path | Description |
|--------|------|-------------|
| `ReachSDK (iOS)` | `mobile/ios/ReachSDK/` | Swift SDK — ReachClient |
| `ReachSDK (Android)` | `mobile/android/reach-sdk/` | Kotlin SDK — ReachClient |
| `ReachIOS` | `apps/mobile/ios/ReachIOS/` | iOS app — MarketplaceClient, MarketplaceModels, ReachShell |
| `Android app` | `apps/mobile/android/` | Android app — MainActivity, ConnectorRegistryClient, MockRunnerGateway, RealRunnerGateway |

### 1.9 Other OSS Core

| Module | Path | Description |
|--------|------|-------------|
| `connector-registry` | `services/connector-registry/` | Connector registry service with marketplace |
| `ide-bridge` | `services/ide-bridge/` | IDE bridge WebSocket server |
| `session-hub` | `services/session-hub/` | Session hub WebSocket server |
| `policy-engine` | `services/policy-engine/` | Policy engine service (stub) |
| `compat` | `compat/` | Compatibility test suite |
| `examples` | `examples/` | SDK usage examples (Express, FastAPI, Next.js, Python, TypeScript, Pack examples) |
| `extensions/vscode` | `extensions/vscode/` | VSCode extension — bridge client, context sync, diff, marketplace, panel |
| `openapi` | `openapi/` | OpenAPI specification |
| `contracts` | `contracts/` | Mobile API contract definitions |
| `design` | `design/` | Design tokens and visual system |
| `config` | `config/` | Economics configuration |
| `data` | `data/` | Test data (evaluation smoke tests) |
| `policies` | `policies/` | Policy manifests (strict-default) |

### 1.10 Demo Web App (`apps/arcade/` — OSS portions)

The arcade app contains BOTH OSS and cloud code. The following submodules are classified as OSS:

| Module | Path | Description |
|--------|------|-------------|
