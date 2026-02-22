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
| UI components | `apps/arcade/src/components/` | React components (NavBar, PackCard, StudioShell, PipelineStage, etc.) |
| Engine libraries | `apps/arcade/src/lib/gate-engine.ts` | Gate evaluation engine |
| Scoring engine | `apps/arcade/src/lib/scoring-engine.ts` | Scoring pipeline |
| Diff engine | `apps/arcade/src/lib/diff-engine.ts` | Diff computation |
| Simulation runner | `apps/arcade/src/lib/simulation-runner.ts` | Simulation execution |
| Tool sandbox | `apps/arcade/src/lib/tool-sandbox.ts` | Tool sandboxing |
| Plugin system | `apps/arcade/src/lib/plugin-system.ts` | Plugin extension system |
| Demo data | `apps/arcade/src/lib/demo-data.ts` | Demo/mock data |
| Templates | `apps/arcade/src/lib/templates.ts` | Pack templates |
| Packs | `apps/arcade/src/lib/packs.ts` | Pack management |
| Runtime | `apps/arcade/src/lib/runtime/` | Runtime providers, skills, tools, types |

---

## 2. Adapter Interface Inventory

These modules define pluggable interfaces that abstract backends.

| Interface | Location | Consumers | Description |
|-----------|----------|-----------|-------------|
| `ProviderAdapter` | [`apps/arcade/src/lib/providers/provider-adapter.ts`](apps/arcade/src/lib/providers/provider-adapter.ts) | Arcade web app | Unified LLM provider abstraction (OpenAI, Anthropic, Google, Mistral, Cohere, Meta, Custom) with health scoring, retries, fallback cascades |
| `ModelAdapter` (Go) | [`services/runner/internal/model/adapter.go`](services/runner/internal/model/adapter.go) | Runner service | LLM adapter abstraction for hosted, local, and deterministic fallback models |
| `ModelFactory` | [`services/runner/internal/model/factory.go`](services/runner/internal/model/factory.go) | Runner service | Factory for creating model adapters |
| `StorageDriver` | [`services/runner/internal/storage/storage.go`](services/runner/internal/storage/storage.go) | Runner service | SQLite-backed storage with migration support |
| `BillingTier` | [`services/billing/tier/tier.go`](services/billing/tier/tier.go) | Capsule-sync (VIOLATION) | Feature gating by billing plan — DEPRECATED |
| `HostedAdapter` | [`services/runner/internal/model/hosted.go`](services/runner/internal/model/hosted.go) | Runner | Hosted LLM adapter |
| `LocalAdapter` | [`services/runner/internal/model/local.go`](services/runner/internal/model/local.go) | Runner | Local/offline LLM adapter |
| `SmallAdapter` | [`services/runner/internal/model/small.go`](services/runner/internal/model/small.go) | Runner | Lightweight model adapter |
| `AdapterRegistry` | [`services/runner/internal/model/adapter_registry.go`](services/runner/internal/model/adapter_registry.go) | Runner | Registry for model adapters |

---

## 3. Cloud Stub Inventory

These modules contain cloud-specific functionality (auth, billing, tenant resolution, cloud storage).

### 3.1 Arcade Cloud Layer

| Module | Path | Feature Flag | Description |
|--------|------|-------------|-------------|
| Cloud Auth | [`apps/arcade/src/lib/cloud-auth.ts`](apps/arcade/src/lib/cloud-auth.ts) | `REACH_CLOUD_ENABLED` | Session auth, API key auth, RBAC, Redis-cached auth contexts |
| Cloud DB | [`apps/arcade/src/lib/cloud-db.ts`](apps/arcade/src/lib/cloud-db.ts) | `REACH_CLOUD_ENABLED` | SQLite control plane — tenants, users, API keys, workflows, packs, entitlements, ops, gates, scenarios, seeds |
| Cloud DB Connection | [`apps/arcade/src/lib/db/connection.ts`](apps/arcade/src/lib/db/connection.ts) | `REACH_CLOUD_ENABLED` | better-sqlite3 connection with `CloudDisabledError` guard |
| Cloud Schemas | [`apps/arcade/src/lib/cloud-schemas.ts`](apps/arcade/src/lib/cloud-schemas.ts) | N/A (schemas only) | Zod validation schemas for all cloud API inputs |
| Stripe Integration | [`apps/arcade/src/lib/stripe.ts`](apps/arcade/src/lib/stripe.ts) | `BILLING_ENABLED` + `STRIPE_SECRET_KEY` | Checkout sessions, customer portal, webhook verification |
| Redis | [`apps/arcade/src/lib/redis.ts`](apps/arcade/src/lib/redis.ts) | `REDIS_URL` | ioredis connection for rate limiting and auth caching |
| Rate Limiting | [`apps/arcade/src/lib/ratelimit.ts`](apps/arcade/src/lib/ratelimit.ts) | Falls back to memory | Redis-backed rate limiting with in-memory fallback |
| Permissions (RBAC) | [`apps/arcade/src/lib/permissions.ts`](apps/arcade/src/lib/permissions.ts) | N/A | RBAC permission helpers for cloud UI gating |
| Env Config | [`apps/arcade/src/lib/env.ts`](apps/arcade/src/lib/env.ts) | N/A | Environment variable schema with cloud-related vars |
| DB Migrations | [`apps/arcade/src/lib/db/migrations.ts`](apps/arcade/src/lib/db/migrations.ts) | `REACH_CLOUD_ENABLED` | Database migration system |
| DB Tenants | [`apps/arcade/src/lib/db/tenants.ts`](apps/arcade/src/lib/db/tenants.ts) | `REACH_CLOUD_ENABLED` | Multi-tenant management |
| DB Users | [`apps/arcade/src/lib/db/users.ts`](apps/arcade/src/lib/db/users.ts) | `REACH_CLOUD_ENABLED` | User management |
| DB Entitlements | [`apps/arcade/src/lib/db/entitlements.ts`](apps/arcade/src/lib/db/entitlements.ts) | `REACH_CLOUD_ENABLED` | Feature entitlements |
| DB Webhooks | [`apps/arcade/src/lib/db/webhooks.ts`](apps/arcade/src/lib/db/webhooks.ts) | `REACH_CLOUD_ENABLED` | Webhook management |
| DB Schema Hardening | [`apps/arcade/src/lib/db/schema-hardening.ts`](apps/arcade/src/lib/db/schema-hardening.ts) | `REACH_CLOUD_ENABLED` | Schema validation hardening |
| Alert Service | [`apps/arcade/src/lib/alert-service.ts`](apps/arcade/src/lib/alert-service.ts) | SMTP vars | Email-based alerting |
| Analytics Server | [`apps/arcade/src/lib/analytics-server.ts`](apps/arcade/src/lib/analytics-server.ts) | N/A | Server-side analytics |
| Marketplace API | [`apps/arcade/src/lib/marketplace-api.ts`](apps/arcade/src/lib/marketplace-api.ts) | Partial | Marketplace API (has stubbed cloud paths) |
| Founder page | [`apps/arcade/src/app/console/founder/page.tsx`](apps/arcade/src/app/console/founder/page.tsx) | Cloud console | Founder dashboard |
| Billing settings | [`apps/arcade/src/app/settings/billing/page.tsx`](apps/arcade/src/app/settings/billing/page.tsx) | Cloud console | Billing management UI |
| API Keys settings | [`apps/arcade/src/app/settings/api-keys/page.tsx`](apps/arcade/src/app/settings/api-keys/page.tsx) | Cloud console | API key management UI |

### 3.2 Billing Service (DEPRECATED)

| Module | Path | Status | Description |
|--------|------|--------|-------------|
| Billing Plans | [`services/billing/internal/billing/plan.go`](services/billing/internal/billing/plan.go) | **DEPRECATED** (frozen 2026-02-18) | Billing tier management — contains duplicated code blocks |
| Billing Tiers | [`services/billing/tier/tier.go`](services/billing/tier/tier.go) | **DEPRECATED** | Feature gating by plan (Free/Pro/Enterprise) |

### 3.3 Capsule Sync (Cloud Service)

| Module | Path | Description |
|--------|------|-------------|
| Capsule Sync API | [`services/capsule-sync/internal/api/server.go`](services/capsule-sync/internal/api/server.go) | REST API for device registration, capsule sync, tier enforcement — imports `services/billing/tier` |
