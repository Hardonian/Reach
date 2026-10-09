# OSS-First Pivot Plan

Last Updated: 2026-02-22

## Objective

This document describes the sequenced plan for transitioning Reach to a local-first, OSS-default architecture. All phases must be completable without cloud credentials. Cloud enterprise features remain available but are isolated behind feature flags and adapter interfaces.

---

## Acceptance Criteria (Global)

- `npm run verify:oss` passes on a clean machine with only Node.js, Go, and Rust installed.
- `reachctl init && reachctl run demo` succeeds without any cloud keys.
- `apps/arcade` builds and displays the demo playground without Redis/Stripe.
- `reachctl replay <run-id>` re-executes any local run and verifies the fingerprint.
- All OSS-path imports are free of cloud SDK references (verified by `validate:oss-purity`).

---

## Phase 0: Foundation (Baseline)

**Status**: ✅ Complete

- [x] Audit repo and map all components (see `OSS_FIRST_COMPONENT_MAP.md`).
- [x] Define system boundaries and layering rules (`BOUNDARIES.md`, `IMPORT_RULES.md`).
- [x] Identify build commands and wire regression armor (`verify:oss`, `validate:boundaries`).
- [x] Document component coupling points (`OSS_FIRST_COMPONENT_MAP.md`).

**Gate**: `npm run validate:oss-purity` passes.

---

## Phase 1: Core Engine Decoupling

**Status**: ✅ Substantially Complete

- [x] Define `StorageDriver` interface in Go engine (`services/runner`).
- [x] Default all storage to `~/.reach/` (SQLite/Filesystem via `SqliteDriver`).
- [x] Stub out `billing` and `auth` dependencies with local noop implementations.
- [x] Deterministic serialization enforced (sorted keys, normalized timestamps).
- [ ] Add `SqliteDriver` migration versioning (WAL + schema versioning).

**Acceptance test**: `reachctl run demo-pack` creates run artifacts at `~/.reach/runs/<run_id>/` without any external dependency.

---

## Phase 2: CLI Hardening

**Status**: ✅ Substantially Complete

- [x] All primary commands (`init`, `run`, `replay`, `doctor`, `export`, `import`, `gc`) work locally.
- [x] `--json` flag supported on all commands.
- [x] Structured error codes (`RL-XXXX`) with machine-readable output.
- [ ] `reachctl diff-run <runA> <runB>` produces a structured diff.
- [ ] `reachctl verify-determinism --n=5` runs 5 identical executions and asserts hash stability.

**Acceptance test**: `reachctl doctor` reports all green on a bare machine with only Go installed.

---

## Phase 3: Web Demo (Arcade) Refactor

**Status**: 🔄 In Progress

- [x] Demo playground loads at `localhost:3000/playground` without backend.
- [x] `REACH_CLOUD` environment flag gates cloud-specific features.
- [ ] "OSS Mode — Local Only" banner displayed when `REACH_CLOUD` is unset.
- [ ] Static demo pipeline pre-loaded without network requests.
- [ ] Evidence chain visualization shows Input → Policy → Artifacts → Output with hashes.

**Acceptance test**: `npm run build -w arcade` succeeds from a cold checkout with no secrets set.

---

## Phase 4: CI/DX Polish

**Status**: ✅ Substantially Complete

- [x] `npm run verify:oss` wired as a required CI gate.
- [x] `validate:language` enforces canonical terminology in UI paths.
- [x] `validate:boundaries` enforces import rules in core paths.
- [x] `validate:oss-purity` blocks cloud SDK imports from OSS paths.
- [ ] Add `verify:oss` as a required status check on GitHub branch protection.

**Acceptance test**: PR with Stripe import in `core/` is blocked by CI.

---

## Phase 5: Stress Harness Validation

**Status**: 🔄 Partial

- [ ] `testdata/stress/` fixtures with nondeterminism injection scenarios created.
- [ ] Go stress tests in `services/runner/internal/determinism/stress_test.go` run N=5 iterations.
- [ ] Rust chaos tests in `crates/engine-core/tests/chaos.rs` run key permutation tests.
- [ ] All stress tests integrated into `verify:oss:full` gate.

**Acceptance test**: `reachctl verify-determinism --n=5` exits 0 with matching hashes across all 5 runs.

---

## Phase 6: Cloud Adapter Formalization

**Status**: 📋 Planned

- [ ] Define adapter interfaces: `AuthProvider`, `BillingProvider`, `ArtifactStore`, `TenantResolver`.
- [ ] Implement OSS stubs that compile and return `RL-4001 CloudNotEnabledError`.
- [ ] Document adapter contracts in `docs/CLOUD_ADAPTER_MODEL.md`.
- [ ] Ensure OSS build passes `validate:oss-purity` at all times.

**Acceptance test**: `REACH_CLOUD=0 npm run validate:oss-purity` exits 0. `REACH_CLOUD=1 reachctl <cloud-command>` navigates the adapter interface.

---

## Rollback Notes

If any phase introduces regressions:

1. The previous `verify:oss` baseline must still pass.
2. Document the regression in this file under the relevant phase.
3. Open a PR with label `regression` before merging the fix.

---

## Verified Baseline (2026-02-22) — Kilo CI Governance Run

| Check              | Command                       | Result                               |
| :----------------- | :---------------------------- | :----------------------------------- |
| Canonical Language | `npm run validate:language`   | ✅ PASSED (0 violations)             |
| Import Boundaries  | `npm run validate:boundaries` | ✅ PASSED                            |
| OSS Purity         | `npm run validate:oss-purity` | ✅ PASSED (zero-cloud lock verified) |
| OSS Gate           | `npm run verify:oss`          | ✅ PASSED (exit 0)                   |

**Known Pre-existing Issues Documented:**

1. `sdk/ts` ESLint v9 config was missing; fixed by creating `sdk/ts/eslint.config.js`.
2. `apps/arcade` `next lint` has a Windows path issue (works in Linux CI).

**Action Required for Branch Protection:**

- Add `verify:oss` as a required status check in GitHub Settings → Branches.
