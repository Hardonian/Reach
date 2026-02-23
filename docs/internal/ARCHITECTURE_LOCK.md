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

### 1.1 Rust Engine - crates/

| Module      | Path                | Description                                                                                                                        |
| ----------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| engine-core | crates/engine-core/ | Deterministic invariants, replay state, signed pack verification, canonical FNV-1a hashing, semver compatibility checks            |
| engine      | crates/engine/      | Workflow execution engine — state machine, policy evaluation, tool dispatch, budget tracking, capsule manifests, artifact patching |
| ffi/c_abi   | crates/ffi/c_abi/   | C ABI foreign function interface for engine — exposes reach_engine_create, reach_start_run, reach_next_action, etc.                |
| ffi/uniffi  | crates/ffi/uniffi/  | UniFFI bindings for engine — Kotlin/Swift interop via create_engine, start_run, next_action, apply_tool_result                     |

Key files:

- [`lib.rs`](../crates/engine/src/lib.rs) — Engine, RunHandle, Action, ExecutionControls, BudgetTracker
- [`state_machine.rs`](../crates/engine/src/state_machine.rs) — WorkflowMachine, MachineState, step/pause/resume/cancel
- [`ir.rs`](../crates/engine/src/ir.rs) — Workflow graph IR with nodes, edges, validation
- [`policy/mod.rs`](../crates/engine/src/policy/mod.rs) — Capability, Policy, ExecutionPolicy, PolicyError
- [`state/mod.rs`](../crates/engine/src/state/mod.rs) — RunStatus, RunEvent, state transitions
- [`capsule.rs`](../crates/engine/src/capsule.rs) — CapsuleManifest deterministic
- [`events.rs`](../crates/engine/src/events.rs) — EngineEvent, EventKind
- [`artifacts/mod.rs`](../crates/engine/src/artifacts/mod.rs) — Diff, Patch
- [`tools/mod.rs`](../crates/engine/src/tools/mod.rs) — ToolSpec, ToolCall, ToolResult
- [`workflow/mod.rs`](../crates/engine/src/workflow/mod.rs) — Workflow, Step, StepKind
- [`invariants/mod.rs`](../crates/engine-core/src/invariants/mod.rs) — canonical_hash, replay verification, pack signature verification, version compatibility

### 1.2 Go Evaluation Engine - core/

| Module     | Path             | Description                                                                                                                                  |
| ---------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| evaluation | core/evaluation/ | Scoring pipeline — grounding validation, policy compliance, tool use validation, latency/token scoring, trend analysis, regression detection |
| federation | core/federation/ | Federation contract types — CapabilityContract, FederationState, PeerInfo, ContractManager                                                   |

Key files:

- [`engine.go`](../core/evaluation/engine.go) — Evaluator, ScoreRun, ComputeTrend, CheckRegression
- [`schema.go`](../core/evaluation/schema.go) — TestDefinition, ScoringResult, ScoringWeights, RegressionThresholds, Feedback, TrendReport
- [`analytics.go`](../core/evaluation/analytics.go) — RetrievalMetrics, AnalyticsModule for RAG analytics
- [`contract.go`](../core/federation/contract.go) — CapabilityContract, PeerInfo

### 1.3 Runner Service - services/runner/

| Module              | Path                                          | Description                                                                                                       |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| reach-serve         | services/runner/cmd/reach-serve/              | HTTP server for local/hosted runs                                                                                 |
| reach-eval          | services/runner/cmd/reach-eval/               | CLI evaluation runner                                                                                             |
| runner-mcp          | services/runner/cmd/runner-mcp/               | MCP server bridge                                                                                                 |
| agents              | services/runner/internal/agents/              | Agent runtime, planner, registry, bridge, contracts                                                               |
| autonomous          | services/runner/internal/autonomous/          | Autonomous orchestration, pack execution, planning, routing                                                       |
| backpressure        | services/runner/internal/backpressure/        | Rate limiting, circuit breakers, retry, semaphore                                                                 |
| config              | services/runner/internal/config/              | Configuration schema and validation                                                                               |
| contextkeys         | services/runner/internal/contextkeys/         | Typed context keys for request scoping                                                                            |
| determinism         | services/runner/internal/determinism/         | Determinism verification, archive, diff, drift detection                                                          |
| engineclient        | services/runner/internal/engineclient/        | Client for Rust engine                                                                                            |
| errors              | services/runner/internal/errors/              | Error codes, classification, formatting                                                                           |
| federation          | services/runner/internal/federation/          | Attestation, coordinator, delegation, identity, reputation                                                        |
| invariants          | services/runner/internal/invariants/          | Core invariant guards                                                                                             |
| jobs                | services/runner/internal/jobs/                | Job queue, DAG executor, budget, branching, event schema                                                          |
| mcpserver           | services/runner/internal/mcpserver/           | MCP protocol server, audit, policy, transport                                                                     |
| mesh                | services/runner/internal/mesh/                | Mesh networking — node, peer, router, handshake, identity, discovery, sync, transport, correlation, rate limiting |
| model               | services/runner/internal/model/               | LLM adapter abstraction — adapter, factory, hosted, local, small, provider, future                                |
| pack                | services/runner/internal/pack/                | Pack validation, linting, merkle tree, scoring, docs                                                              |
| packloader          | services/runner/internal/packloader/          | Pack loading, manifest parsing, lockfile, sandbox, containment, version, injection                                |
| performance         | services/runner/internal/performance/         | Memory optimization, performance optimizer                                                                        |
| plugins             | services/runner/internal/plugins/             | Plugin signature verification                                                                                     |
| poee                | services/runner/internal/poee/                | Policy Orchestration Execution Engine, mesh integration                                                           |
| policy              | services/runner/internal/policy/              | Policy gate evaluation                                                                                            |
| registry            | services/runner/internal/registry/            | Capability registry, graph, pack registry, reputation                                                             |
| sandbox             | services/runner/internal/sandbox/             | Execution sandbox                                                                                                 |
| spec                | services/runner/internal/spec/                | Spec version validation                                                                                           |
| storage             | services/runner/internal/storage/             | SQLite storage with migrations                                                                                    |
| support             | services/runner/internal/support/             | Support bot                                                                                                       |
| telemetry           | services/runner/internal/telemetry/           | Logger, metrics, tracing, pack telemetry                                                                          |
| workspace           | services/runner/internal/workspace/           | Workspace and runner management                                                                                   |
| arcade/gamification | services/runner/internal/arcade/gamification/ | Gamification and achievement system                                                                               |
| audit               | services/runner/internal/audit/               | Receipt-based audit trail                                                                                         |

### 1.4 Pack DevKit - pack-devkit/

| Module    | Path                   | Description                                                                                          |
| --------- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| harness   | pack-devkit/harness/   | Test harness, linter, doctor, publisher, registry validator, scoring, docs generator                 |
| templates | pack-devkit/templates/ | Pack templates: governed-minimal, governed-with-policy, governed-with-replay-tests, federation-aware |
| fixtures  | pack-devkit/fixtures/  | Test fixtures: hello-deterministic, policy-denial, replay-verification                               |

### 1.5 Internal PackKit - internal/packkit/

| Module   | Path                       | Description                                 |
| -------- | -------------------------- | ------------------------------------------- |
| config   | internal/packkit/config/   | Pack configuration                          |
| lockfile | internal/packkit/lockfile/ | Lockfile parsing and validation             |
| manifest | internal/packkit/manifest/ | Manifest parsing                            |
| registry | internal/packkit/registry/ | Registry index management with golden tests |
| resolver | internal/packkit/resolver/ | Dependency resolution                       |
| signing  | internal/packkit/signing/  | Ed25519 manifest signature verification     |

### 1.6 Protocol Schemas - protocol/

| Module       | Path                   | Description                                                                                 |
| ------------ | ---------------------- | ------------------------------------------------------------------------------------------- |
| v1           | protocol/v1/           | V1 JSON schemas: capsule, connector, event, execution-contract, marketplace, session, spawn |
| schemas      | protocol/schemas/      | Core schemas: agent-contract, artifact, events, orchestration-plan, toolcall, etc.          |
| ide          | protocol/ide/          | IDE bridge schemas: apply_patch, approval_request, context, notification                    |
| integrations | protocol/integrations/ | Integration schemas: manifests, webhooks, OAuth                                             |
| plugins      | protocol/plugins/      | Plugin manifest schema                                                                      |
| examples     | protocol/examples/     | Protocol examples: capsule_sync, guardrail_stop, marketplace, run events, bundles           |

### 1.7 SDKs - sdk/

| Module | Path        | Description                                 |
| ------ | ----------- | ------------------------------------------- |
| python | sdk/python/ | Python SDK — ReachClient, types, exceptions |
| ts     | sdk/ts/     | TypeScript SDK — client library             |

### 1.8 Mobile SDKs

| Module           | Path                      | Description                                                                               |
| ---------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| ReachSDK iOS     | mobile/ios/ReachSDK/      | Swift SDK — ReachClient                                                                   |
| ReachSDK Android | mobile/android/reach-sdk/ | Kotlin SDK — ReachClient                                                                  |
| ReachIOS         | apps/mobile/ios/ReachIOS/ | iOS app — MarketplaceClient, MarketplaceModels, ReachShell                                |
| Android app      | apps/mobile/android/      | Android app — MainActivity, ConnectorRegistryClient, MockRunnerGateway, RealRunnerGateway |

### 1.9 Other OSS Core

| Module             | Path                         | Description                                                                      |
| ------------------ | ---------------------------- | -------------------------------------------------------------------------------- |
| connector-registry | services/connector-registry/ | Connector registry service with marketplace                                      |
| ide-bridge         | services/ide-bridge/         | IDE bridge WebSocket server                                                      |
| session-hub        | services/session-hub/        | Session hub WebSocket server                                                     |
| policy-engine      | services/policy-engine/      | Policy engine service stub                                                       |
| compat             | compat/                      | Compatibility test suite                                                         |
| examples           | examples/                    | SDK usage examples: Express, FastAPI, Next.js, Python, TypeScript, Pack examples |
| extensions/vscode  | extensions/vscode/           | VSCode extension — bridge client, context sync, diff, marketplace, panel         |
| openapi            | openapi/                     | OpenAPI specification                                                            |
| contracts          | contracts/                   | Mobile API contract definitions                                                  |
| design             | design/                      | Design tokens and visual system                                                  |
| config             | config/                      | Economics configuration                                                          |
| data               | data/                        | Test data for evaluation smoke tests                                             |
| policies           | policies/                    | Policy manifests: strict-default                                                 |

### 1.10 Demo Web App - apps/arcade/ OSS portions

The arcade app contains BOTH OSS and cloud code. The following submodules are classified as OSS:

| Module            | Path                                     | Description                                                          |
| ----------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| UI components     | apps/arcade/src/components/              | React components: NavBar, PackCard, StudioShell, PipelineStage, etc. |
| Engine libraries  | apps/arcade/src/lib/gate-engine.ts       | Gate evaluation engine                                               |
| Scoring engine    | apps/arcade/src/lib/scoring-engine.ts    | Scoring pipeline                                                     |
| Diff engine       | apps/arcade/src/lib/diff-engine.ts       | Diff computation                                                     |
| Simulation runner | apps/arcade/src/lib/simulation-runner.ts | Simulation execution                                                 |
| Tool sandbox      | apps/arcade/src/lib/tool-sandbox.ts      | Tool sandboxing                                                      |
| Plugin system     | apps/arcade/src/lib/plugin-system.ts     | Plugin extension system                                              |
| Demo data         | apps/arcade/src/lib/demo-data.ts         | Demo/mock data                                                       |
| Templates         | apps/arcade/src/lib/templates.ts         | Pack templates                                                       |
| Packs             | apps/arcade/src/lib/packs.ts             | Pack management                                                      |
| Runtime           | apps/arcade/src/lib/runtime/             | Runtime providers, skills, tools, types                              |

---

## 2. Adapter Interface Inventory

These modules define pluggable interfaces that abstract backends.

| Interface       | Location                                           | Consumers              | Description                                                                                                                                  |
| --------------- | -------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ProviderAdapter | apps/arcade/src/lib/providers/provider-adapter.ts  | Arcade web app         | Unified LLM provider abstraction: OpenAI, Anthropic, Google, Mistral, Cohere, Meta, Custom — with health scoring, retries, fallback cascades |
| ModelAdapter Go | services/runner/internal/model/adapter.go          | Runner service         | LLM adapter abstraction for hosted, local, and deterministic fallback models                                                                 |
| ModelFactory    | services/runner/internal/model/factory.go          | Runner service         | Factory for creating model adapters                                                                                                          |
| StorageDriver   | services/runner/internal/storage/storage.go        | Runner service         | SQLite-backed storage with migration support                                                                                                 |
| BillingTier     | services/billing/tier/tier.go                      | Capsule-sync VIOLATION | Feature gating by billing plan — DEPRECATED                                                                                                  |
| HostedAdapter   | services/runner/internal/model/hosted.go           | Runner                 | Hosted LLM adapter                                                                                                                           |
| LocalAdapter    | services/runner/internal/model/local.go            | Runner                 | Local/offline LLM adapter                                                                                                                    |
| SmallAdapter    | services/runner/internal/model/small.go            | Runner                 | Lightweight model adapter                                                                                                                    |
| AdapterRegistry | services/runner/internal/model/adapter_registry.go | Runner                 | Registry for model adapters                                                                                                                  |

---

## 3. Cloud Stub Inventory

These modules contain cloud-specific functionality: auth, billing, tenant resolution, cloud storage.

### 3.1 Arcade Cloud Layer

| Module              | Path                                           | Feature Flag                        | Description                                                                                                   |
| ------------------- | ---------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cloud Auth          | apps/arcade/src/lib/cloud-auth.ts              | REACH_CLOUD_ENABLED                 | Session auth, API key auth, RBAC, Redis-cached auth contexts                                                  |
| Cloud DB            | apps/arcade/src/lib/cloud-db.ts                | REACH_CLOUD_ENABLED                 | SQLite control plane — tenants, users, API keys, workflows, packs, entitlements, ops, gates, scenarios, seeds |
| Cloud DB Connection | apps/arcade/src/lib/db/connection.ts           | REACH_CLOUD_ENABLED                 | better-sqlite3 connection with CloudDisabledError guard                                                       |
| Cloud Schemas       | apps/arcade/src/lib/cloud-schemas.ts           | N/A schemas only                    | Zod validation schemas for all cloud API inputs                                                               |
| Stripe Integration  | apps/arcade/src/lib/stripe.ts                  | BILLING_ENABLED + STRIPE_SECRET_KEY | Checkout sessions, customer portal, webhook verification                                                      |
| Redis               | apps/arcade/src/lib/redis.ts                   | REDIS_URL                           | ioredis connection for rate limiting and auth caching                                                         |
| Rate Limiting       | apps/arcade/src/lib/ratelimit.ts               | Falls back to memory                | Redis-backed rate limiting with in-memory fallback                                                            |
| Permissions RBAC    | apps/arcade/src/lib/permissions.ts             | N/A                                 | RBAC permission helpers for cloud UI gating                                                                   |
| Env Config          | apps/arcade/src/lib/env.ts                     | N/A                                 | Environment variable schema with cloud-related vars                                                           |
| DB Migrations       | apps/arcade/src/lib/db/migrations.ts           | REACH_CLOUD_ENABLED                 | Database migration system                                                                                     |
| DB Tenants          | apps/arcade/src/lib/db/tenants.ts              | REACH_CLOUD_ENABLED                 | Multi-tenant management                                                                                       |
| DB Users            | apps/arcade/src/lib/db/users.ts                | REACH_CLOUD_ENABLED                 | User management                                                                                               |
| DB Entitlements     | apps/arcade/src/lib/db/entitlements.ts         | REACH_CLOUD_ENABLED                 | Feature entitlements                                                                                          |
| DB Webhooks         | apps/arcade/src/lib/db/webhooks.ts             | REACH_CLOUD_ENABLED                 | Webhook management                                                                                            |
| DB Schema Hardening | apps/arcade/src/lib/db/schema-hardening.ts     | REACH_CLOUD_ENABLED                 | Schema validation hardening                                                                                   |
| Alert Service       | apps/arcade/src/lib/alert-service.ts           | SMTP vars                           | Email-based alerting                                                                                          |
| Analytics Server    | apps/arcade/src/lib/analytics-server.ts        | N/A                                 | Server-side analytics                                                                                         |
| Marketplace API     | apps/arcade/src/lib/marketplace-api.ts         | Partial                             | Marketplace API with stubbed cloud paths                                                                      |
| Founder page        | apps/arcade/src/app/console/founder/page.tsx   | Cloud console                       | Founder dashboard                                                                                             |
| Billing settings    | apps/arcade/src/app/settings/billing/page.tsx  | Cloud console                       | Billing management UI                                                                                         |
| API Keys settings   | apps/arcade/src/app/settings/api-keys/page.tsx | Cloud console                       | API key management UI                                                                                         |

### 3.2 Billing Service - DEPRECATED

| Module        | Path                                      | Status                       | Description                                               |
| ------------- | ----------------------------------------- | ---------------------------- | --------------------------------------------------------- |
| Billing Plans | services/billing/internal/billing/plan.go | DEPRECATED frozen 2026-02-18 | Billing tier management — contains duplicated code blocks |
| Billing Tiers | services/billing/tier/tier.go             | DEPRECATED                   | Feature gating by plan: Free/Pro/Enterprise               |

### 3.3 Capsule Sync - Cloud Service

| Module             | Path                                          | Description                                                                                      |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Capsule Sync API   | services/capsule-sync/internal/api/server.go  | REST API for device registration, capsule sync, tier enforcement — imports services/billing/tier |
| Capsule Sync Core  | services/capsule-sync/internal/core/types.go  | Core types: Device, SyncRequest, CapsuleMetadata, RepoSyncMode                                   |
| Capsule Sync Store | services/capsule-sync/internal/store/store.go | In-memory capsule storage                                                                        |

### 3.4 Runner Cloud Error Types

| Module      | Path                                     | Description                                                                     |
| ----------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| Cloud Error | services/runner/internal/errors/cloud.go | CloudNotEnabledError — graceful degradation for cloud-only features in OSS mode |

---

## 4. Dead Code Candidates

### 4.1 High Confidence — Safe to Remove

| Path                                                          | Justification                                                                                                                                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| services/billing/internal/billing/plan.go lines 62-98         | Duplicated code: The FeatureSet function body is repeated 3+ times after line 61. The file has severe copy-paste corruption.                                                                          |
| services/runner/\*.test.exe 8 files                           | Compiled test binaries checked into source. Should be in .gitignore: adaptive.test.exe, engineclient.test.exe, pack.test.exe, performance.test.exe, plugins.test.exe, spec.test.exe, storage.test.exe |
| services/runner/reach-eval.exe                                | Compiled binary checked into source                                                                                                                                                                   |
| services/runner/reach-serve.exe                               | Compiled binary checked into source                                                                                                                                                                   |
| services/runner/reachctl.exe                                  | Compiled binary checked into source                                                                                                                                                                   |
| services/connector-registry/connector-registry.exe            | Compiled binary checked into source                                                                                                                                                                   |
| services/session-hub/session-hub.exe                          | Compiled binary checked into source                                                                                                                                                                   |
| reachctl.exe at root                                          | Compiled binary at repo root                                                                                                                                                                          |
| services/runner/test_failures.txt                             | Test output artifact                                                                                                                                                                                  |
| services/runner/test_output.txt                               | Test output artifact                                                                                                                                                                                  |
| services/runner/test_res.txt                                  | Test output artifact                                                                                                                                                                                  |
| services/runner/test_results_final.txt                        | Test output artifact                                                                                                                                                                                  |
| services/runner/coverage                                      | Coverage artifact                                                                                                                                                                                     |
| services/connector-registry/test_output.txt                   | Test output artifact                                                                                                                                                                                  |
| services/connector-registry/internal/registry/test_out.txt    | Test output artifact                                                                                                                                                                                  |
| apps/arcade/ts_check_output.txt                               | Empty TypeScript check artifact                                                                                                                                                                       |
| apps/arcade/ts_errors_new.txt                                 | TypeScript error dump                                                                                                                                                                                 |
| apps/arcade/ts_final_check.txt                                | Empty TypeScript check artifact                                                                                                                                                                       |
| reach_stax_multiturn_200_rows.csv at root                     | Data file at repo root — 458KB CSV                                                                                                                                                                    |
| Reach_MASTER_PACK.zip at root                                 | Archive at repo root                                                                                                                                                                                  |
| reach.zip at root                                             | Archive at repo root — 1.3MB                                                                                                                                                                          |
| reach-to-readylayer.patch at root                             | Large patch file at repo root — 110KB                                                                                                                                                                 |
| stitch_reach_technical_architecture_visualization.zip at root | Large archive — 14.8MB                                                                                                                                                                                |
| stitch_readylayer_home_page_redesign 2.zip at root            | Large archive — 24.5MB                                                                                                                                                                                |
| inventory.txt at root                                         | Stale inventory text file                                                                                                                                                                             |

### 4.2 Medium Confidence — Likely Dead but Needs Verification

| Path                                    | Justification                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| apps/mobile/ duplicate                  | Appears to duplicate mobile/ directory. Both contain iOS ReachIOS and Android mobile apps. Verify which is canonical. |
| ARTIFACTS/reach_cloud_build/BASELINE.md | Build artifact documentation — may be obsolete post-OSS pivot                                                         |
| services/billing/ entire directory      | Marked DEPRECATED since 2026-02-18. Still imported by capsule-sync. Should be decoupled before removal.               |
| services/policy-engine/                 | Minimal stub — main.go is 352 chars, loader.go is 660 chars. Appears to be a placeholder with no active consumers.    |

### 4.3 Root-Level Files to Consider Relocating

| Path                          | Suggestion                                           |
| ----------------------------- | ---------------------------------------------------- |
| reach bash script 3.7KB       | Consider moving to scripts/                          |
| ADAPTIVE_ENGINE_SPEC.md       | Consider moving to docs/                             |
| AUTOPACK_SPEC.md              | Consider moving to docs/                             |
| CAPABILITY_REGISTRY.md        | Consider moving to docs/                             |
| CAPABILITY_SYSTEM.md          | Consider moving to docs/                             |
| KIP.md                        | Consider moving to docs/                             |
| READY_LAYER_STRATEGY.md       | Consider moving to docs/ — duplicate exists in docs/ |
| RUN_CAPSULES_REPLAY.md        | Consider moving to docs/                             |
| SECURITY_HARDENING_REPORT.md  | Consider moving to docs/                             |
| SECURITY_MODEL.md             | Consider moving to docs/                             |
| SKILLS.md                     | Consider moving to docs/                             |
| SPEC_FORMALIZATION_SUMMARY.md | Consider moving to docs/                             |

---

## 5. Security Surface Map

### 5.1 Cryptographic Operations

| Surface                       | Location                                           | Algorithm     | Purpose                                                |
| ----------------------------- | -------------------------------------------------- | ------------- | ------------------------------------------------------ |
| Canonical hashing             | crates/engine-core/src/invariants/mod.rs:14        | FNV-1a 64-bit | Deterministic replay verification and integrity checks |
| Pack signature verification   | internal/packkit/signing/signing.go:27             | Ed25519       | Verify manifest signatures against trusted public keys |
| Ed25519 key normalization     | internal/packkit/signing/signing.go:16             | Ed25519       | Normalize private key formats: seed vs full key        |
| Device signature verification | services/capsule-sync/internal/api/server.go:60    | HMAC-SHA256   | Device registration signature verification             |
| Stripe webhook verification   | apps/arcade/src/lib/stripe.ts:80                   | Stripe SDK    | Webhook signature verification                         |
| Plugin verification           | services/runner/internal/plugins/verify.go         | varies        | Plugin signature verification                          |
| Merkle trees                  | services/runner/internal/pack/merkle.go            | SHA256        | Pack content integrity via merkle proofs               |
| Hardware attestation          | services/runner/internal/federation/attestation.go | varies        | Federation attestation                                 |
| Mesh identity                 | services/runner/internal/mesh/identity.go          | varies        | Mesh peer identity verification                        |
| Mesh handshake                | services/runner/internal/mesh/handshake.go         | varies        | Secure mesh peer handshake                             |

### 5.2 Authentication and Authorization

| Surface              | Location                                        | Mechanism                                  | Description                                  |
| -------------------- | ----------------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| Session auth         | apps/arcade/src/lib/cloud-auth.ts               | Cookie reach_session to web_sessions table | Session-based web authentication             |
| API key auth         | apps/arcade/src/lib/cloud-auth.ts               | Bearer rk*live*... to api_keys table       | API key authentication                       |
| RBAC permissions     | apps/arcade/src/lib/permissions.ts              | Role hierarchy                             | viewer < member < admin < owner              |
| Policy gate          | services/runner/internal/policy/gate.go         | Rego-compatible                            | Execution policy enforcement                 |
| Device trust levels  | services/capsule-sync/internal/core/types.go:53 | trust_level field                          | Device trust classification for capsule sync |
| Degraded permissions | apps/arcade/src/lib/permissions.ts:44           | DEGRADED_PERMISSIONS                       | Read-only fallback when auth unavailable     |

### 5.3 Secrets and Sensitive Data

| Surface               | Location                                    | Risk       | Description                                                                     |
| --------------------- | ------------------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| Environment secrets   | apps/arcade/src/lib/env.ts                  | HIGH       | Stripe keys, GitHub secrets, encryption keys, SMTP credentials, webhook secrets |
| Sanitization          | apps/arcade/src/lib/sanitize.ts             | Mitigation | Redacts tokens, secrets, passwords, JWTs from logs                              |
| Encryption key        | REACH_ENCRYPTION_KEY_BASE64 env var         | HIGH       | Base64-encoded encryption key for cloud data                                    |
| Device signing secret | DEVICE_SIGNING_SECRET env var               | MEDIUM     | HMAC secret for device registration — falls back to dev-device-secret           |
| Trusted keys store    | docs/marketplace/examples/trusted-keys.json | LOW        | Example trusted public keys for pack verification                               |

### 5.4 Rate Limiting and DoS Protection

| Surface               | Location                                              | Mechanism                                                  |
| --------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| API rate limiting     | apps/arcade/src/lib/ratelimit.ts                      | Redis-backed with in-memory fallback at 10 req/min default |
| Mesh rate limiting    | services/runner/internal/mesh/ratelimit.go            | Token bucket rate limiter for mesh peers                   |
| Backpressure          | services/runner/internal/backpressure/backpressure.go | Adaptive circuit breaker, semaphore, retry                 |
| Max pending events    | crates/engine/src/lib.rs:21                           | 10000 event cap with oldest-first eviction                 |
| Max workflow size     | crates/engine/src/lib.rs:24                           | 16 MiB limit                                               |
| C string length limit | crates/ffi/c_abi/src/lib.rs:21                        | 16 MiB limit                                               |

### 5.5 Unsafe Code

| Surface              | Location                    | Risk                                                                                                                     |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| unsafe_code = forbid | crates/Cargo.toml:16        | Workspace-wide forbid on unsafe Rust code                                                                                |
| C ABI unsafe FFI     | crates/ffi/c_abi/src/lib.rs | Required for C interop — from_c_str, reach_compile_workflow, reach_start_run, reach_apply_tool_result, reach_string_free |

---

## 6. Module Dependency Graph

```text
                     +-------------------------------------+
                     |         UI Layer                     |
                     +-------------------------------------+
                     | apps/arcade - Next.js                |
                     | extensions/vscode                    |
                     | mobile/ + apps/mobile/               |
                     +------+-------------+----------------+
                            |             |
               +------------v--+   +------v--------------+
               | Cloud Stubs   |   | OSS Core APIs       |
               | feat-flagged  |   |                      |
               +---------------+   +----------------------+
               | cloud-auth.ts |   | sdk/ts               |
               | cloud-db.ts   |   | sdk/python           |
               | stripe.ts     |   | openapi/             |
               | redis.ts      |   | protocol/            |
               +-------+-------+   +------+---------------+
                       |                  |
                       v                  v
               +----------------------------------------------+
               |       Services Layer                          |
               +----------------------------------------------+
               | services/runner - Go                          |
               | services/connector-registry - Go              |
               | services/ide-bridge - Go                      |
               | services/session-hub - Go                     |
               | services/capsule-sync - Go --- VIOLATION --+  |
               | services/policy-engine - Go, stub           | |
               +------+--------------------------------------+|
                      |                                        |
                      v                                        v
               +--------------------+  +----------------------+
               | Engine Layer       |  | DEPRECATED           |
               +--------------------+  | services/billing     |
               | crates/engine Rust |  | frozen 2026-02-18    |
               | crates/engine-core |  +----------------------+
               | crates/ffi/c_abi   |
               | crates/ffi/uniffi  |
               +------+-------------+
                      |
                      v
               +----------------------------+
               | Evaluation Layer            |
               +----------------------------+
               | core/evaluation - Go        |
               | core/federation - Go        |
               +----------------------------+

               +----------------------------+
               | Dev Tooling Layer           |
               +----------------------------+
               | internal/packkit - Go       |
               | pack-devkit/ - Go           |
               | scripts/ - TS/MJS/Shell     |
               | compat/ - MJS               |
               +----------------------------+

               +----------------------------+
               | Infrastructure Layer        |
               +----------------------------+
               | .github/workflows/          |
               | docker/ - nginx, prometheus |
               +----------------------------+
```

---

## 7. Boundary Violations Found

### VIOLATION 1: capsule-sync imports billing - CRITICAL

**File**: [`services/capsule-sync/go.mod`](../services/capsule-sync/go.mod:5)

```
require reach/services/billing v0.0.0
```

**File**: [`services/capsule-sync/internal/api/server.go`](../services/capsule-sync/internal/api/server.go:13)

```go
import "reach/services/billing/tier"
```

**Impact**: capsule-sync has a hard compile-time dependency on the DEPRECATED services/billing package. The `enforceTier` function directly calls `tier.ParsePlan` and `tier.Allows` for feature gating.

**Required Fix**: Extract tier/feature gating into a standalone interface. Either:

1. Move tier types to a shared core/features package
2. Replace with configuration-flag-based feature gating as described in services/billing/DEPRECATED.md

### VIOLATION 2: Compiled Binaries in Source Control

Multiple compiled .exe files and test binaries are checked into the repository:

- reachctl.exe at root, 15.4MB
- services/runner/\*.exe with 7 binaries, roughly 80MB total
- services/connector-registry/connector-registry.exe at 9.3MB
- services/session-hub/session-hub.exe at 8.4MB

These should be added to .gitignore and removed from tracking.

### VIOLATION 3: Duplicated Code in plan.go

**File**: [`services/billing/internal/billing/plan.go`](../services/billing/internal/billing/plan.go:62)

The FeatureSet function body is duplicated 3+ times after line 61, indicating copy-paste corruption. This file would not compile.

### VIOLATION 4: Duplicate Mobile Directory Structure

Both mobile/ and apps/mobile/ exist with overlapping content:

- mobile/ios/ReachSDK/ is duplicated at apps/mobile/ios/
- mobile/android/ partially overlaps with apps/mobile/android/

One should be designated canonical and the other removed.

---

## Appendix A: CI Workflow Inventory

| Workflow                | Path                                      | Purpose                       |
| ----------------------- | ----------------------------------------- | ----------------------------- |
| ci.yml                  | .github/workflows/ci.yml                  | Primary CI pipeline           |
| ci-go.yml               | .github/workflows/ci-go.yml               | Go-specific CI                |
| security-audit.yml      | .github/workflows/security-audit.yml      | Security scanning             |
| verify.yml              | .github/workflows/verify.yml              | Determinism verification      |
| anti-sprawl.yml         | .github/workflows/anti-sprawl.yml         | Route/entropy enforcement     |
| simplicity.yml          | .github/workflows/simplicity.yml          | Simplicity gate               |
| readylayer-gate.yml     | .github/workflows/readylayer-gate.yml     | ReadyLayer quality gate       |
| perf-gate.yml           | .github/workflows/perf-gate.yml           | Performance gate              |
| docs-drift.yml          | .github/workflows/docs-drift.yml          | Documentation drift detection |
| marketplace-publish.yml | .github/workflows/marketplace-publish.yml | Marketplace publishing        |
| mobile-android.yml      | .github/workflows/mobile-android.yml      | Android CI                    |
| mobile-ios.yml          | .github/workflows/mobile-ios.yml          | iOS CI                        |
| release.yml             | .github/workflows/release.yml             | Release pipeline              |

## Appendix B: Script Inventory

| Script                         | Path                                   | Purpose                           |
| ------------------------------ | -------------------------------------- | --------------------------------- |
| validate-import-boundaries.ts  | scripts/validate-import-boundaries.ts  | Enforce import boundary rules     |
| validate-oss-purity.ts         | scripts/validate-oss-purity.ts         | Verify no cloud SDKs in OSS paths |
| anti-sprawl.mjs                | scripts/anti-sprawl.mjs                | Prevent route explosion           |
| validate-brand.ts              | scripts/validate-brand.ts              | Brand consistency validation      |
| validate-canonical-language.ts | scripts/validate-canonical-language.ts | Canonical language enforcement    |
| validate-simplicity.ts         | scripts/validate-simplicity.ts         | Simplicity metrics validation     |
| verify-env.mjs                 | scripts/verify-env.mjs                 | Environment variable validation   |
| verify-no-toxic-deps.mjs       | scripts/verify-no-toxic-deps.mjs       | Toxic dependency detection        |
| verify-packs.mjs               | scripts/verify-packs.mjs               | Pack verification                 |
| verify-prod-install.mjs        | scripts/verify-prod-install.mjs        | Production install verification   |
| check-node-version.mjs         | scripts/check-node-version.mjs         | Node.js version check             |
| check-route-duplication.mjs    | scripts/check-route-duplication.mjs    | Route duplication detection       |
| smoke-test.sh                  | scripts/smoke-test.sh                  | Smoke test suite                  |
| seed-founder.mjs               | scripts/seed-founder.mjs               | Founder seed data                 |
| suite-doctor.mjs               | scripts/suite-doctor.mjs               | Suite health check                |
| android-bootstrap.sh           | scripts/android-bootstrap.sh           | Android environment setup         |
| install-termux.sh              | scripts/install-termux.sh              | Termux installation               |
| pre-commit-language-check.sh   | scripts/pre-commit-language-check.sh   | Pre-commit language guard         |

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

### 1.1 Rust Engine - crates/

| Module      | Path                | Description                                                                                                                        |
| ----------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| engine-core | crates/engine-core/ | Deterministic invariants, replay state, signed pack verification, canonical FNV-1a hashing, semver compatibility checks            |
| engine      | crates/engine/      | Workflow execution engine — state machine, policy evaluation, tool dispatch, budget tracking, capsule manifests, artifact patching |
| ffi/c_abi   | crates/ffi/c_abi/   | C ABI foreign function interface for engine — exposes reach_engine_create, reach_start_run, reach_next_action, etc.                |
| ffi/uniffi  | crates/ffi/uniffi/  | UniFFI bindings for engine — Kotlin/Swift interop via create_engine, start_run, next_action, apply_tool_result                     |

Key files:

- [`lib.rs`](../crates/engine/src/lib.rs) — Engine, RunHandle, Action, ExecutionControls, BudgetTracker
- [`state_machine.rs`](../crates/engine/src/state_machine.rs) — WorkflowMachine, MachineState, step/pause/resume/cancel
- [`ir.rs`](../crates/engine/src/ir.rs) — Workflow graph IR with nodes, edges, validation
- [`policy/mod.rs`](../crates/engine/src/policy/mod.rs) — Capability, Policy, ExecutionPolicy, PolicyError
- [`state/mod.rs`](../crates/engine/src/state/mod.rs) — RunStatus, RunEvent, state transitions
- [`capsule.rs`](../crates/engine/src/capsule.rs) — CapsuleManifest deterministic
- [`events.rs`](../crates/engine/src/events.rs) — EngineEvent, EventKind
- [`artifacts/mod.rs`](../crates/engine/src/artifacts/mod.rs) — Diff, Patch
- [`tools/mod.rs`](../crates/engine/src/tools/mod.rs) — ToolSpec, ToolCall, ToolResult
- [`workflow/mod.rs`](../crates/engine/src/workflow/mod.rs) — Workflow, Step, StepKind
- [`invariants/mod.rs`](../crates/engine-core/src/invariants/mod.rs) — canonical_hash, replay verification, pack signature verification, version compatibility

### 1.2 Go Evaluation Engine - core/

| Module     | Path             | Description                                                                                                                                  |
| ---------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| evaluation | core/evaluation/ | Scoring pipeline — grounding validation, policy compliance, tool use validation, latency/token scoring, trend analysis, regression detection |
| federation | core/federation/ | Federation contract types — CapabilityContract, FederationState, PeerInfo, ContractManager                                                   |

Key files:

- [`engine.go`](../core/evaluation/engine.go) — Evaluator, ScoreRun, ComputeTrend, CheckRegression
- [`schema.go`](../core/evaluation/schema.go) — TestDefinition, ScoringResult, ScoringWeights, RegressionThresholds, Feedback, TrendReport
- [`analytics.go`](../core/evaluation/analytics.go) — RetrievalMetrics, AnalyticsModule for RAG analytics
- [`contract.go`](../core/federation/contract.go) — CapabilityContract, PeerInfo

### 1.3 Runner Service - services/runner/

| Module              | Path                                          | Description                                                                                                       |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| reach-serve         | services/runner/cmd/reach-serve/              | HTTP server for local/hosted runs                                                                                 |
| reach-eval          | services/runner/cmd/reach-eval/               | CLI evaluation runner                                                                                             |
| runner-mcp          | services/runner/cmd/runner-mcp/               | MCP server bridge                                                                                                 |
| agents              | services/runner/internal/agents/              | Agent runtime, planner, registry, bridge, contracts                                                               |
| autonomous          | services/runner/internal/autonomous/          | Autonomous orchestration, pack execution, planning, routing                                                       |
| backpressure        | services/runner/internal/backpressure/        | Rate limiting, circuit breakers, retry, semaphore                                                                 |
| config              | services/runner/internal/config/              | Configuration schema and validation                                                                               |
| contextkeys         | services/runner/internal/contextkeys/         | Typed context keys for request scoping                                                                            |
| determinism         | services/runner/internal/determinism/         | Determinism verification, archive, diff, drift detection                                                          |
| engineclient        | services/runner/internal/engineclient/        | Client for Rust engine                                                                                            |
| errors              | services/runner/internal/errors/              | Error codes, classification, formatting                                                                           |
| federation          | services/runner/internal/federation/          | Attestation, coordinator, delegation, identity, reputation                                                        |
| invariants          | services/runner/internal/invariants/          | Core invariant guards                                                                                             |
| jobs                | services/runner/internal/jobs/                | Job queue, DAG executor, budget, branching, event schema                                                          |
| mcpserver           | services/runner/internal/mcpserver/           | MCP protocol server, audit, policy, transport                                                                     |
| mesh                | services/runner/internal/mesh/                | Mesh networking — node, peer, router, handshake, identity, discovery, sync, transport, correlation, rate limiting |
| model               | services/runner/internal/model/               | LLM adapter abstraction — adapter, factory, hosted, local, small, provider, future                                |
| pack                | services/runner/internal/pack/                | Pack validation, linting, merkle tree, scoring, docs                                                              |
| packloader          | services/runner/internal/packloader/          | Pack loading, manifest parsing, lockfile, sandbox, containment, version, injection                                |
| performance         | services/runner/internal/performance/         | Memory optimization, performance optimizer                                                                        |
| plugins             | services/runner/internal/plugins/             | Plugin signature verification                                                                                     |
| poee                | services/runner/internal/poee/                | Policy Orchestration Execution Engine, mesh integration                                                           |
| policy              | services/runner/internal/policy/              | Policy gate evaluation                                                                                            |
| registry            | services/runner/internal/registry/            | Capability registry, graph, pack registry, reputation                                                             |
| sandbox             | services/runner/internal/sandbox/             | Execution sandbox                                                                                                 |
| spec                | services/runner/internal/spec/                | Spec version validation                                                                                           |
| storage             | services/runner/internal/storage/             | SQLite storage with migrations                                                                                    |
| support             | services/runner/internal/support/             | Support bot                                                                                                       |
| telemetry           | services/runner/internal/telemetry/           | Logger, metrics, tracing, pack telemetry                                                                          |
| workspace           | services/runner/internal/workspace/           | Workspace and runner management                                                                                   |
| arcade/gamification | services/runner/internal/arcade/gamification/ | Gamification and achievement system                                                                               |
| audit               | services/runner/internal/audit/               | Receipt-based audit trail                                                                                         |

### 1.4 Pack DevKit - pack-devkit/

| Module    | Path                   | Description                                                                                          |
| --------- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| harness   | pack-devkit/harness/   | Test harness, linter, doctor, publisher, registry validator, scoring, docs generator                 |
| templates | pack-devkit/templates/ | Pack templates: governed-minimal, governed-with-policy, governed-with-replay-tests, federation-aware |
| fixtures  | pack-devkit/fixtures/  | Test fixtures: hello-deterministic, policy-denial, replay-verification                               |

### 1.5 Internal PackKit - internal/packkit/

| Module   | Path                       | Description                                 |
| -------- | -------------------------- | ------------------------------------------- |
| config   | internal/packkit/config/   | Pack configuration                          |
| lockfile | internal/packkit/lockfile/ | Lockfile parsing and validation             |
| manifest | internal/packkit/manifest/ | Manifest parsing                            |
| registry | internal/packkit/registry/ | Registry index management with golden tests |
| resolver | internal/packkit/resolver/ | Dependency resolution                       |
| signing  | internal/packkit/signing/  | Ed25519 manifest signature verification     |

### 1.6 Protocol Schemas - protocol/

| Module       | Path                   | Description                                                                                 |
| ------------ | ---------------------- | ------------------------------------------------------------------------------------------- |
| v1           | protocol/v1/           | V1 JSON schemas: capsule, connector, event, execution-contract, marketplace, session, spawn |
| schemas      | protocol/schemas/      | Core schemas: agent-contract, artifact, events, orchestration-plan, toolcall, etc.          |
| ide          | protocol/ide/          | IDE bridge schemas: apply_patch, approval_request, context, notification                    |
| integrations | protocol/integrations/ | Integration schemas: manifests, webhooks, OAuth                                             |
| plugins      | protocol/plugins/      | Plugin manifest schema                                                                      |
| examples     | protocol/examples/     | Protocol examples: capsule_sync, guardrail_stop, marketplace, run events, bundles           |

### 1.7 SDKs - sdk/

| Module | Path        | Description                                 |
| ------ | ----------- | ------------------------------------------- |
| python | sdk/python/ | Python SDK — ReachClient, types, exceptions |
| ts     | sdk/ts/     | TypeScript SDK — client library             |

### 1.8 Mobile SDKs

| Module           | Path                      | Description                                                                               |
| ---------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| ReachSDK iOS     | mobile/ios/ReachSDK/      | Swift SDK — ReachClient                                                                   |
| ReachSDK Android | mobile/android/reach-sdk/ | Kotlin SDK — ReachClient                                                                  |
| ReachIOS         | apps/mobile/ios/ReachIOS/ | iOS app — MarketplaceClient, MarketplaceModels, ReachShell                                |
| Android app      | apps/mobile/android/      | Android app — MainActivity, ConnectorRegistryClient, MockRunnerGateway, RealRunnerGateway |

### 1.9 Other OSS Core

| Module             | Path                         | Description                                                                      |
| ------------------ | ---------------------------- | -------------------------------------------------------------------------------- |
| connector-registry | services/connector-registry/ | Connector registry service with marketplace                                      |
| ide-bridge         | services/ide-bridge/         | IDE bridge WebSocket server                                                      |
| session-hub        | services/session-hub/        | Session hub WebSocket server                                                     |
| policy-engine      | services/policy-engine/      | Policy engine service stub                                                       |
| compat             | compat/                      | Compatibility test suite                                                         |
| examples           | examples/                    | SDK usage examples: Express, FastAPI, Next.js, Python, TypeScript, Pack examples |
| extensions/vscode  | extensions/vscode/           | VSCode extension — bridge client, context sync, diff, marketplace, panel         |
| openapi            | openapi/                     | OpenAPI specification                                                            |
| contracts          | contracts/                   | Mobile API contract definitions                                                  |
| design             | design/                      | Design tokens and visual system                                                  |
| config             | config/                      | Economics configuration                                                          |
| data               | data/                        | Test data for evaluation smoke tests                                             |
| policies           | policies/                    | Policy manifests: strict-default                                                 |

### 1.10 Demo Web App - apps/arcade/ OSS portions

The arcade app contains BOTH OSS and cloud code. The following submodules are classified as OSS:

| Module            | Path                                     | Description                                                          |
| ----------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| UI components     | apps/arcade/src/components/              | React components: NavBar, PackCard, StudioShell, PipelineStage, etc. |
| Engine libraries  | apps/arcade/src/lib/gate-engine.ts       | Gate evaluation engine                                               |
| Scoring engine    | apps/arcade/src/lib/scoring-engine.ts    | Scoring pipeline                                                     |
| Diff engine       | apps/arcade/src/lib/diff-engine.ts       | Diff computation                                                     |
| Simulation runner | apps/arcade/src/lib/simulation-runner.ts | Simulation execution                                                 |
| Tool sandbox      | apps/arcade/src/lib/tool-sandbox.ts      | Tool sandboxing                                                      |
| Plugin system     | apps/arcade/src/lib/plugin-system.ts     | Plugin extension system                                              |
| Demo data         | apps/arcade/src/lib/demo-data.ts         | Demo/mock data                                                       |
| Templates         | apps/arcade/src/lib/templates.ts         | Pack templates                                                       |
| Packs             | apps/arcade/src/lib/packs.ts             | Pack management                                                      |
| Runtime           | apps/arcade/src/lib/runtime/             | Runtime providers, skills, tools, types                              |

---

## 2. Adapter Interface Inventory

These modules define pluggable interfaces that abstract backends.

| Interface       | Location                                           | Consumers              | Description                                                                                                                                  |
| --------------- | -------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ProviderAdapter | apps/arcade/src/lib/providers/provider-adapter.ts  | Arcade web app         | Unified LLM provider abstraction: OpenAI, Anthropic, Google, Mistral, Cohere, Meta, Custom — with health scoring, retries, fallback cascades |
| ModelAdapter Go | services/runner/internal/model/adapter.go          | Runner service         | LLM adapter abstraction for hosted, local, and deterministic fallback models                                                                 |
| ModelFactory    | services/runner/internal/model/factory.go          | Runner service         | Factory for creating model adapters                                                                                                          |
| StorageDriver   | services/runner/internal/storage/storage.go        | Runner service         | SQLite-backed storage with migration support                                                                                                 |
| BillingTier     | services/billing/tier/tier.go                      | Capsule-sync VIOLATION | Feature gating by billing plan — DEPRECATED                                                                                                  |
| HostedAdapter   | services/runner/internal/model/hosted.go           | Runner                 | Hosted LLM adapter                                                                                                                           |
| LocalAdapter    | services/runner/internal/model/local.go            | Runner                 | Local/offline LLM adapter                                                                                                                    |
| SmallAdapter    | services/runner/internal/model/small.go            | Runner                 | Lightweight model adapter                                                                                                                    |
| AdapterRegistry | services/runner/internal/model/adapter_registry.go | Runner                 | Registry for model adapters                                                                                                                  |

---

## 3. Cloud Stub Inventory

These modules contain cloud-specific functionality: auth, billing, tenant resolution, cloud storage.

### 3.1 Arcade Cloud Layer

| Module              | Path                                           | Feature Flag                        | Description                                                                                                   |
| ------------------- | ---------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cloud Auth          | apps/arcade/src/lib/cloud-auth.ts              | REACH_CLOUD_ENABLED                 | Session auth, API key auth, RBAC, Redis-cached auth contexts                                                  |
| Cloud DB            | apps/arcade/src/lib/cloud-db.ts                | REACH_CLOUD_ENABLED                 | SQLite control plane — tenants, users, API keys, workflows, packs, entitlements, ops, gates, scenarios, seeds |
| Cloud DB Connection | apps/arcade/src/lib/db/connection.ts           | REACH_CLOUD_ENABLED                 | better-sqlite3 connection with CloudDisabledError guard                                                       |
| Cloud Schemas       | apps/arcade/src/lib/cloud-schemas.ts           | N/A schemas only                    | Zod validation schemas for all cloud API inputs                                                               |
| Stripe Integration  | apps/arcade/src/lib/stripe.ts                  | BILLING_ENABLED + STRIPE_SECRET_KEY | Checkout sessions, customer portal, webhook verification                                                      |
| Redis               | apps/arcade/src/lib/redis.ts                   | REDIS_URL                           | ioredis connection for rate limiting and auth caching                                                         |
| Rate Limiting       | apps/arcade/src/lib/ratelimit.ts               | Falls back to memory                | Redis-backed rate limiting with in-memory fallback                                                            |
| Permissions RBAC    | apps/arcade/src/lib/permissions.ts             | N/A                                 | RBAC permission helpers for cloud UI gating                                                                   |
| Env Config          | apps/arcade/src/lib/env.ts                     | N/A                                 | Environment variable schema with cloud-related vars                                                           |
| DB Migrations       | apps/arcade/src/lib/db/migrations.ts           | REACH_CLOUD_ENABLED                 | Database migration system                                                                                     |
| DB Tenants          | apps/arcade/src/lib/db/tenants.ts              | REACH_CLOUD_ENABLED                 | Multi-tenant management                                                                                       |
| DB Users            | apps/arcade/src/lib/db/users.ts                | REACH_CLOUD_ENABLED                 | User management                                                                                               |
| DB Entitlements     | apps/arcade/src/lib/db/entitlements.ts         | REACH_CLOUD_ENABLED                 | Feature entitlements                                                                                          |
| DB Webhooks         | apps/arcade/src/lib/db/webhooks.ts             | REACH_CLOUD_ENABLED                 | Webhook management                                                                                            |
| DB Schema Hardening | apps/arcade/src/lib/db/schema-hardening.ts     | REACH_CLOUD_ENABLED                 | Schema validation hardening                                                                                   |
| Alert Service       | apps/arcade/src/lib/alert-service.ts           | SMTP vars                           | Email-based alerting                                                                                          |
| Analytics Server    | apps/arcade/src/lib/analytics-server.ts        | N/A                                 | Server-side analytics                                                                                         |
| Marketplace API     | apps/arcade/src/lib/marketplace-api.ts         | Partial                             | Marketplace API with stubbed cloud paths                                                                      |
| Founder page        | apps/arcade/src/app/console/founder/page.tsx   | Cloud console                       | Founder dashboard                                                                                             |
| Billing settings    | apps/arcade/src/app/settings/billing/page.tsx  | Cloud console                       | Billing management UI                                                                                         |
| API Keys settings   | apps/arcade/src/app/settings/api-keys/page.tsx | Cloud console                       | API key management UI                                                                                         |

### 3.2 Billing Service - DEPRECATED

| Module        | Path                                      | Status                       | Description                                               |
| ------------- | ----------------------------------------- | ---------------------------- | --------------------------------------------------------- |
| Billing Plans | services/billing/internal/billing/plan.go | DEPRECATED frozen 2026-02-18 | Billing tier management — contains duplicated code blocks |
| Billing Tiers | services/billing/tier/tier.go             | DEPRECATED                   | Feature gating by plan: Free/Pro/Enterprise               |

### 3.3 Capsule Sync - Cloud Service

| Module             | Path                                          | Description                                                                                      |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Capsule Sync API   | services/capsule-sync/internal/api/server.go  | REST API for device registration, capsule sync, tier enforcement — imports services/billing/tier |
| Capsule Sync Core  | services/capsule-sync/internal/core/types.go  | Core types: Device, SyncRequest, CapsuleMetadata, RepoSyncMode                                   |
| Capsule Sync Store | services/capsule-sync/internal/store/store.go | In-memory capsule storage                                                                        |

### 3.4 Runner Cloud Error Types

| Module      | Path                                     | Description                                                                     |
| ----------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| Cloud Error | services/runner/internal/errors/cloud.go | CloudNotEnabledError — graceful degradation for cloud-only features in OSS mode |

---

## 4. Dead Code Candidates

### 4.1 High Confidence — Safe to Remove

| Path                                                          | Justification                                                                                                                                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| services/billing/internal/billing/plan.go lines 62-98         | Duplicated code: The FeatureSet function body is repeated 3+ times after line 61. The file has severe copy-paste corruption.                                                                          |
| services/runner/\*.test.exe 8 files                           | Compiled test binaries checked into source. Should be in .gitignore: adaptive.test.exe, engineclient.test.exe, pack.test.exe, performance.test.exe, plugins.test.exe, spec.test.exe, storage.test.exe |
| services/runner/reach-eval.exe                                | Compiled binary checked into source                                                                                                                                                                   |
| services/runner/reach-serve.exe                               | Compiled binary checked into source                                                                                                                                                                   |
| services/runner/reachctl.exe                                  | Compiled binary checked into source                                                                                                                                                                   |
| services/connector-registry/connector-registry.exe            | Compiled binary checked into source                                                                                                                                                                   |
| services/session-hub/session-hub.exe                          | Compiled binary checked into source                                                                                                                                                                   |
| reachctl.exe at root                                          | Compiled binary at repo root                                                                                                                                                                          |
| services/runner/test_failures.txt                             | Test output artifact                                                                                                                                                                                  |
| services/runner/test_output.txt                               | Test output artifact                                                                                                                                                                                  |
| services/runner/test_res.txt                                  | Test output artifact                                                                                                                                                                                  |
| services/runner/test_results_final.txt                        | Test output artifact                                                                                                                                                                                  |
| services/runner/coverage                                      | Coverage artifact                                                                                                                                                                                     |
| services/connector-registry/test_output.txt                   | Test output artifact                                                                                                                                                                                  |
| services/connector-registry/internal/registry/test_out.txt    | Test output artifact                                                                                                                                                                                  |
| apps/arcade/ts_check_output.txt                               | Empty TypeScript check artifact                                                                                                                                                                       |
| apps/arcade/ts_errors_new.txt                                 | TypeScript error dump                                                                                                                                                                                 |
| apps/arcade/ts_final_check.txt                                | Empty TypeScript check artifact                                                                                                                                                                       |
| reach_stax_multiturn_200_rows.csv at root                     | Data file at repo root — 458KB CSV                                                                                                                                                                    |
| Reach_MASTER_PACK.zip at root                                 | Archive at repo root                                                                                                                                                                                  |
| reach.zip at root                                             | Archive at repo root — 1.3MB                                                                                                                                                                          |
| reach-to-readylayer.patch at root                             | Large patch file at repo root — 110KB                                                                                                                                                                 |
| stitch_reach_technical_architecture_visualization.zip at root | Large archive — 14.8MB                                                                                                                                                                                |
| stitch_readylayer_home_page_redesign 2.zip at root            | Large archive — 24.5MB                                                                                                                                                                                |
| inventory.txt at root                                         | Stale inventory text file                                                                                                                                                                             |

### 4.2 Medium Confidence — Likely Dead but Needs Verification

| Path                                    | Justification                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| apps/mobile/ duplicate                  | Appears to duplicate mobile/ directory. Both contain iOS ReachIOS and Android mobile apps. Verify which is canonical. |
| ARTIFACTS/reach_cloud_build/BASELINE.md | Build artifact documentation — may be obsolete post-OSS pivot                                                         |
| services/billing/ entire directory      | Marked DEPRECATED since 2026-02-18. Still imported by capsule-sync. Should be decoupled before removal.               |
| services/policy-engine/                 | Minimal stub — main.go is 352 chars, loader.go is 660 chars. Appears to be a placeholder with no active consumers.    |

### 4.3 Root-Level Files to Consider Relocating

| Path                          | Suggestion                                           |
| ----------------------------- | ---------------------------------------------------- |
| reach bash script 3.7KB       | Consider moving to scripts/                          |
| ADAPTIVE_ENGINE_SPEC.md       | Consider moving to docs/                             |
| AUTOPACK_SPEC.md              | Consider moving to docs/                             |
| CAPABILITY_REGISTRY.md        | Consider moving to docs/                             |
| CAPABILITY_SYSTEM.md          | Consider moving to docs/                             |
| KIP.md                        | Consider moving to docs/                             |
| READY_LAYER_STRATEGY.md       | Consider moving to docs/ — duplicate exists in docs/ |
| RUN_CAPSULES_REPLAY.md        | Consider moving to docs/                             |
| SECURITY_HARDENING_REPORT.md  | Consider moving to docs/                             |
| SECURITY_MODEL.md             | Consider moving to docs/                             |
| SKILLS.md                     | Consider moving to docs/                             |
| SPEC_FORMALIZATION_SUMMARY.md | Consider moving to docs/                             |

---

## 5. Security Surface Map

### 5.1 Cryptographic Operations

| Surface                       | Location                                           | Algorithm     | Purpose                                                |
| ----------------------------- | -------------------------------------------------- | ------------- | ------------------------------------------------------ |
| Canonical hashing             | crates/engine-core/src/invariants/mod.rs:14        | FNV-1a 64-bit | Deterministic replay verification and integrity checks |
| Pack signature verification   | internal/packkit/signing/signing.go:27             | Ed25519       | Verify manifest signatures against trusted public keys |
| Ed25519 key normalization     | internal/packkit/signing/signing.go:16             | Ed25519       | Normalize private key formats: seed vs full key        |
| Device signature verification | services/capsule-sync/internal/api/server.go:60    | HMAC-SHA256   | Device registration signature verification             |
| Stripe webhook verification   | apps/arcade/src/lib/stripe.ts:80                   | Stripe SDK    | Webhook signature verification                         |
| Plugin verification           | services/runner/internal/plugins/verify.go         | varies        | Plugin signature verification                          |
| Merkle trees                  | services/runner/internal/pack/merkle.go            | SHA256        | Pack content integrity via merkle proofs               |
| Hardware attestation          | services/runner/internal/federation/attestation.go | varies        | Federation attestation                                 |
| Mesh identity                 | services/runner/internal/mesh/identity.go          | varies        | Mesh peer identity verification                        |
| Mesh handshake                | services/runner/internal/mesh/handshake.go         | varies        | Secure mesh peer handshake                             |

### 5.2 Authentication and Authorization

| Surface              | Location                                        | Mechanism                                  | Description                                  |
| -------------------- | ----------------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| Session auth         | apps/arcade/src/lib/cloud-auth.ts               | Cookie reach_session to web_sessions table | Session-based web authentication             |
| API key auth         | apps/arcade/src/lib/cloud-auth.ts               | Bearer rk*live*... to api_keys table       | API key authentication                       |
| RBAC permissions     | apps/arcade/src/lib/permissions.ts              | Role hierarchy                             | viewer < member < admin < owner              |
| Policy gate          | services/runner/internal/policy/gate.go         | Rego-compatible                            | Execution policy enforcement                 |
| Device trust levels  | services/capsule-sync/internal/core/types.go:53 | trust_level field                          | Device trust classification for capsule sync |
| Degraded permissions | apps/arcade/src/lib/permissions.ts:44           | DEGRADED_PERMISSIONS                       | Read-only fallback when auth unavailable     |

### 5.3 Secrets and Sensitive Data

| Surface               | Location                                    | Risk       | Description                                                                     |
| --------------------- | ------------------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| Environment secrets   | apps/arcade/src/lib/env.ts                  | HIGH       | Stripe keys, GitHub secrets, encryption keys, SMTP credentials, webhook secrets |
| Sanitization          | apps/arcade/src/lib/sanitize.ts             | Mitigation | Redacts tokens, secrets, passwords, JWTs from logs                              |
| Encryption key        | REACH_ENCRYPTION_KEY_BASE64 env var         | HIGH       | Base64-encoded encryption key for cloud data                                    |
| Device signing secret | DEVICE_SIGNING_SECRET env var               | MEDIUM     | HMAC secret for device registration — falls back to dev-device-secret           |
| Trusted keys store    | docs/marketplace/examples/trusted-keys.json | LOW        | Example trusted public keys for pack verification                               |

### 5.4 Rate Limiting and DoS Protection

| Surface               | Location                                              | Mechanism                                                  |
| --------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| API rate limiting     | apps/arcade/src/lib/ratelimit.ts                      | Redis-backed with in-memory fallback at 10 req/min default |
| Mesh rate limiting    | services/runner/internal/mesh/ratelimit.go            | Token bucket rate limiter for mesh peers                   |
| Backpressure          | services/runner/internal/backpressure/backpressure.go | Adaptive circuit breaker, semaphore, retry                 |
| Max pending events    | crates/engine/src/lib.rs:21                           | 10000 event cap with oldest-first eviction                 |
| Max workflow size     | crates/engine/src/lib.rs:24                           | 16 MiB limit                                               |
| C string length limit | crates/ffi/c_abi/src/lib.rs:21                        | 16 MiB limit                                               |

### 5.5 Unsafe Code

| Surface              | Location                    | Risk                                                                                                                     |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| unsafe_code = forbid | crates/Cargo.toml:16        | Workspace-wide forbid on unsafe Rust code                                                                                |
| C ABI unsafe FFI     | crates/ffi/c_abi/src/lib.rs | Required for C interop — from_c_str, reach_compile_workflow, reach_start_run, reach_apply_tool_result, reach_string_free |

---

## 6. Module Dependency Graph

```text
                     +-------------------------------------+
                     |         UI Layer                     |
                     +-------------------------------------+
                     | apps/arcade - Next.js                |
                     | extensions/vscode                    |
                     | mobile/ + apps/mobile/               |
                     +------+-------------+----------------+
                            |             |
               +------------v--+   +------v--------------+
               | Cloud Stubs   |   | OSS Core APIs       |
               | feat-flagged  |   |                      |
               +---------------+   +----------------------+
               | cloud-auth.ts |   | sdk/ts               |
               | cloud-db.ts   |   | sdk/python           |
               | stripe.ts     |   | openapi/             |
               | redis.ts      |   | protocol/            |
               +-------+-------+   +------+---------------+
                       |                  |
                       v                  v
               +----------------------------------------------+
               |       Services Layer                          |
               +----------------------------------------------+
               | services/runner - Go                          |
               | services/connector-registry - Go              |
               | services/ide-bridge - Go                      |
               | services/session-hub - Go                     |
               | services/capsule-sync - Go --- VIOLATION --+  |
               | services/policy-engine - Go, stub           | |
               +------+--------------------------------------+|
                      |                                        |
                      v                                        v
               +--------------------+  +----------------------+
               | Engine Layer       |  | DEPRECATED           |
               +--------------------+  | services/billing     |
               | crates/engine Rust |  | frozen 2026-02-18    |
               | crates/engine-core |  +----------------------+
               | crates/ffi/c_abi   |
               | crates/ffi/uniffi  |
               +------+-------------+
                      |
                      v
               +----------------------------+
               | Evaluation Layer            |
               +----------------------------+
               | core/evaluation - Go        |
               | core/federation - Go        |
               +----------------------------+

               +----------------------------+
               | Dev Tooling Layer           |
               +----------------------------+
               | internal/packkit - Go       |
               | pack-devkit/ - Go           |
               | scripts/ - TS/MJS/Shell     |
               | compat/ - MJS               |
               +----------------------------+

               +----------------------------+
               | Infrastructure Layer        |
               +----------------------------+
               | .github/workflows/          |
               | docker/ - nginx, prometheus |
               +----------------------------+
```

---

## 7. Boundary Violations Found

### VIOLATION 1: capsule-sync imports billing - CRITICAL

**File**: [`services/capsule-sync/go.mod`](../services/capsule-sync/go.mod:5)

```
require reach/services/billing v0.0.0
```

**File**: [`services/capsule-sync/internal/api/server.go`](../services/capsule-sync/internal/api/server.go:13)

```go
import "reach/services/billing/tier"
```

**Impact**: capsule-sync has a hard compile-time dependency on the DEPRECATED services/billing package. The `enforceTier` function directly calls `tier.ParsePlan` and `tier.Allows` for feature gating.

**Required Fix**: Extract tier/feature gating into a standalone interface. Either:

1. Move tier types to a shared core/features package
2. Replace with configuration-flag-based feature gating as described in services/billing/DEPRECATED.md

### VIOLATION 2: Compiled Binaries in Source Control

Multiple compiled .exe files and test binaries are checked into the repository:

- reachctl.exe at root, 15.4MB
- services/runner/\*.exe with 7 binaries, roughly 80MB total
- services/connector-registry/connector-registry.exe at 9.3MB
- services/session-hub/session-hub.exe at 8.4MB

These should be added to .gitignore and removed from tracking.

### VIOLATION 3: Duplicated Code in plan.go

**File**: [`services/billing/internal/billing/plan.go`](../services/billing/internal/billing/plan.go:62)

The FeatureSet function body is duplicated 3+ times after line 61, indicating copy-paste corruption. This file would not compile.

### VIOLATION 4: Duplicate Mobile Directory Structure

Both mobile/ and apps/mobile/ exist with overlapping content:

- mobile/ios/ReachSDK/ is duplicated at apps/mobile/ios/
- mobile/android/ partially overlaps with apps/mobile/android/

One should be designated canonical and the other removed.

---

## Appendix A: CI Workflow Inventory

| Workflow                | Path                                      | Purpose                       |
| ----------------------- | ----------------------------------------- | ----------------------------- |
| ci.yml                  | .github/workflows/ci.yml                  | Primary CI pipeline           |
| ci-go.yml               | .github/workflows/ci-go.yml               | Go-specific CI                |
| security-audit.yml      | .github/workflows/security-audit.yml      | Security scanning             |
| verify.yml              | .github/workflows/verify.yml              | Determinism verification      |
| anti-sprawl.yml         | .github/workflows/anti-sprawl.yml         | Route/entropy enforcement     |
| simplicity.yml          | .github/workflows/simplicity.yml          | Simplicity gate               |
| readylayer-gate.yml     | .github/workflows/readylayer-gate.yml     | ReadyLayer quality gate       |
| perf-gate.yml           | .github/workflows/perf-gate.yml           | Performance gate              |
| docs-drift.yml          | .github/workflows/docs-drift.yml          | Documentation drift detection |
| marketplace-publish.yml | .github/workflows/marketplace-publish.yml | Marketplace publishing        |
| mobile-android.yml      | .github/workflows/mobile-android.yml      | Android CI                    |
| mobile-ios.yml          | .github/workflows/mobile-ios.yml          | iOS CI                        |
| release.yml             | .github/workflows/release.yml             | Release pipeline              |

## Appendix B: Script Inventory

| Script                         | Path                                   | Purpose                           |
| ------------------------------ | -------------------------------------- | --------------------------------- |
| validate-import-boundaries.ts  | scripts/validate-import-boundaries.ts  | Enforce import boundary rules     |
| validate-oss-purity.ts         | scripts/validate-oss-purity.ts         | Verify no cloud SDKs in OSS paths |
| anti-sprawl.mjs                | scripts/anti-sprawl.mjs                | Prevent route explosion           |
| validate-brand.ts              | scripts/validate-brand.ts              | Brand consistency validation      |
| validate-canonical-language.ts | scripts/validate-canonical-language.ts | Canonical language enforcement    |
| validate-simplicity.ts         | scripts/validate-simplicity.ts         | Simplicity metrics validation     |
| verify-env.mjs                 | scripts/verify-env.mjs                 | Environment variable validation   |
| verify-no-toxic-deps.mjs       | scripts/verify-no-toxic-deps.mjs       | Toxic dependency detection        |
| verify-packs.mjs               | scripts/verify-packs.mjs               | Pack verification                 |
| verify-prod-install.mjs        | scripts/verify-prod-install.mjs        | Production install verification   |
| check-node-version.mjs         | scripts/check-node-version.mjs         | Node.js version check             |
| check-route-duplication.mjs    | scripts/check-route-duplication.mjs    | Route duplication detection       |
| smoke-test.sh                  | scripts/smoke-test.sh                  | Smoke test suite                  |
| seed-founder.mjs               | scripts/seed-founder.mjs               | Founder seed data                 |
| suite-doctor.mjs               | scripts/suite-doctor.mjs               | Suite health check                |
| android-bootstrap.sh           | scripts/android-bootstrap.sh           | Android environment setup         |
| install-termux.sh              | scripts/install-termux.sh              | Termux installation               |
| pre-commit-language-check.sh   | scripts/pre-commit-language-check.sh   | Pre-commit language guard         |
