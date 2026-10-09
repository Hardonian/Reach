# Roadmap: Kilo — Deterministic CI Governance

Last Updated: 2026-02-22

## Vision

Reach Kilo is the stability milestone: a fully reproducible, determinism-guaranteed local execution environment with hardened CI governance. After Kilo, every Reach run can be proved, replayed, and diffed by any operator on any machine.

---

## Milestone K1: Deterministic Storage Lock

**Goal**: All run artifacts hashed and stored in a stable, reproducible structure.

| Task                         | Status  | Description                                                  |
| :--------------------------- | :------ | :----------------------------------------------------------- |
| SQLite schema versioning     | ✅ Done | Versioned migrations in `services/runner/internal/storage`   |
| WAL mode enabled             | ✅ Done | Write-Ahead Logging prevents corruption on concurrent access |
| Run directory layout         | ✅ Done | `~/.reach/runs/<run_id>/{meta.json, artifacts/, logs/}`      |
| Stable artifact hashing      | ✅ Done | SHA-256 over sorted-key canonical JSON                       |
| `reachctl gc`                | ✅ Done | Prunes old run data safely                                   |
| `reachctl data-dir`          | ✅ Done | Prints canonical data path                                   |
| Export bundle (`.reach.zip`) | ✅ Done | Portable artifact export                                     |
| Import bundle                | ✅ Done | Re-imports exported capsule for local replay                 |

**Gate**: `reachctl run demo && reachctl verify-determinism --n=5` → all hashes match.

---

## Milestone K2: Replay Protocol Lock

**Goal**: 100% bit-for-bit replay accuracy for all local runs.

| Task                             | Status         | Description                                                                                |
| :------------------------------- | :------------- | :----------------------------------------------------------------------------------------- |
| Canonical run model              | ✅ Done        | `run_id`, `engine_version`, `policy_version`, `input_hash`, `artifact_hash`, `output_hash` |
| Normalized timestamps            | ✅ Done        | UTC epoch, no wall-clock entropy in deterministic paths                                    |
| Stable JSON serialization        | ✅ Done        | Sorted keys, deterministic array ordering                                                  |
| `reachctl replay <run-id>`       | ✅ Done        | Full replay from event log                                                                 |
| `reachctl diff-run <A> <B>`      | 🔄 In Progress | Structured diff between two run fingerprints                                               |
| Replay integrity proof           | ✅ Done        | SHA-256 fingerprint of event log + run_id                                                  |
| Golden fixture conformance tests | ✅ Done        | `testdata/fixtures/conformance/`                                                           |

**Gate**: `reachctl replay <run-id>` on any stored run returns `REPLAY_VERIFIED`.

---

## Milestone K3: CLI UX Polish

**Goal**: Production-ready `reachctl` for local-first operations with no panics.

| Task                                | Status         | Description                         |
| :---------------------------------- | :------------- | :---------------------------------- |
| All commands support `--json`       | ✅ Done        | Machine-readable structured output  |
| Structured error codes (`RL-XXXX`)  | ✅ Done        | See `docs/ERROR_CODE_REGISTRY.md`   |
| `reachctl doctor`                   | ✅ Done        | Environment health check            |
| `reachctl explain-failure <run-id>` | ✅ Done        | Human + JSON failure explanation    |
| `reachctl benchmark`                | ✅ Done        | Performance measurement harness     |
| `reachctl verify-determinism`       | ✅ Done        | N-run determinism verification      |
| `reachctl diff-run`                 | 🔄 In Progress | Run comparison output               |
| No uncaught panics                  | ✅ Done        | All paths wrapped with `ReachError` |

**Gate**: `reachctl init && reachctl run demo && reachctl replay <last-run-id>` exits 0.

---

## Milestone K4: Plugin Sandboxing

**Goal**: Ensure plugins cannot break determinism or leak state.

| Task                                         | Status  | Description                                |
| :------------------------------------------- | :------ | :----------------------------------------- |
| Plugin capability boundaries                 | ✅ Done | Defined in `CAPABILITY_REGISTRY.md`        |
| Tool call isolation                          | ✅ Done | Each tool call runs in a sandboxed context |
| Policy gate evaluation before tool execution | ✅ Done | Gates evaluated in deterministic order     |
| Plugin signing validation                    | ✅ Done | Manifest signature verification            |

**Gate**: `validate:boundaries` passes. No plugin can import cloud SDKs directly.

---

## Milestone K5: CI Governance Full Lock (Current Sprint)

**Goal**: Full deterministic CI with OSS purity guaranteed on every commit.

| Task                                     | Status         | Description                                                                           |
| :--------------------------------------- | :------------- | :------------------------------------------------------------------------------------ |
| `verify:oss` CI gate (required)          | ✅ Done        | Runs lint + typecheck + validate:language + validate:boundaries + validate:oss-purity |
| `validate:language` CI check             | ✅ Done        | Canonical terminology enforcement on UI paths                                         |
| `validate:boundaries` CI check           | ✅ Done        | Import boundary enforcement                                                           |
| `validate:oss-purity` CI check           | ✅ Done        | Zero-cloud lock verification                                                          |
| Deterministic stress harness in CI       | 🔄 In Progress | `testdata/stress/` fixtures + N=5 determinism runs                                    |
| Branch protection: `verify:oss` required | 📋 Planned     | GitHub Branch Protection rule                                                         |

**Gate**: Every PR must pass `verify:oss` before merge. Zero exceptions.

---

## Milestone Mega: Enterprise Foundations

**Goal**: Extensibility for hosted environments. Adapters stub-complete but not deployed.

- **M1: Cloud Adapter Suite** — `AuthProvider`, `BillingProvider`, `ArtifactStore`, `TenantResolver` interfaces.
- **M2: Multi-tenancy Isolation** — Sandbox logic for shared compute environments.
- **M3: Admin Dashboard** — Enterprise-grade visibility (stubbed in OSS, activated in Cloud).

---

## Milestone Giga: Cloud Scale

**Goal**: Reach as a hosted service.

- **G1: Stateless Runner Clusters** — Horizontal scaling.
- **G2: Global Registry** — Federated plugin discovery.
- **G3: Advanced Compliance** — PII scrubbing, enterprise guardrails.

---

## CI Governance Rules

1. No code merged without passing `verify:oss`.
2. No cloud SDK imported in any `OSS Core` component (enforced by `validate:oss-purity`).
3. Public APIs must remain backward-compatible (Protocol V1).
4. Dependency sprawl is treated as a security vulnerability (enforced by `anti-sprawl.yml`).
5. All new execution features require a golden fixture in `testdata/fixtures/conformance/`.
6. Determinism breaches require immediate rollback and root-cause analysis.
