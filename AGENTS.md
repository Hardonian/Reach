# Reach – AGENTS.md

Last Updated: 2026-02-22

## Purpose

Defines autonomous agent roles, responsibilities, and constraints for **Reach**. This document is the authoritative contract for all agents (human and automated) contributing to the Reach codebase.

---

## Global Principles

- **Production-grade output only** — No placeholders, no TODOs in merged code.
- **Deterministic file changes** — Prefer minimal diffs; every change must maintain or reduce system entropy.
- **Never delete content** unless directly conflicting with newer validated structure.
- **Optimize for clarity, minimal context, and high leverage** — Do the most impactful thing with the least surface area.
- **User routes must never hard-500** — All user-facing code paths must return structured graceful errors.
- **OSS-first by default** — All changes must work without `REACH_CLOUD=1`.

---

## Agent Roles

| Role | Responsibilities |
| :--- | :--- |
| **Architecture Agent** | System design, invariants, boundaries, modular cohesion |
| **Code Quality Agent** | Lint/typecheck/build, hydration/perf passes, vulnerability hygiene |
| **Design Agent** | Visual system integrity, tokens, UI coherence, hero/motion alignment |
| **Infrastructure Agent** | CI/resilience, env validation, security hardening, deploy readiness |
| **Release Agent** | Changelog discipline, versioning, smoke verification, rollback notes |
| **Documentation Agent** | README/CHANGELOG/ADR updates, eliminates redundancy |

---

## Deterministic CI Principles for Agents

All agents contributing to Reach must adhere to the following guardrails. These are enforced by CI checks that will block non-compliant PRs.

### 1. Entropy Reduction

Every change must either maintain or reduce the system's total entropy. Specifically:

- Never introduce `time.Now()`, `rand.Int()`, or UUID v4 in fingerprint-contributing code paths.
- Never iterate over Go maps without sorting keys first.
- Never use unsorted arrays in hashing paths unless explicitly documented as order-sensitive.

**CI Enforcement**: `cargo test -p engine-core` + `go test ./internal/determinism/...`

### 2. Boundary Enforcement

Respect the [Import Boundaries](docs/IMPORT_RULES.md). Never leak cloud-specific dependencies into OSS Core components.

- `core/` must NOT import `services/billing`, `stripe`, `auth0`, `@google-cloud`, or `aws-sdk`.
- `services/runner/cmd/reachctl` must NOT import `apps/arcade`, `next`, or `react`.

**CI Enforcement**: `npm run validate:boundaries` (required CI check)

### 3. OSS Purity

The OSS build must pass without any cloud credentials or cloud SDK imports in OSS Core paths.

**CI Enforcement**: `npm run validate:oss-purity` (required CI check)

### 4. Drift Detection

Before opening a PR, verify determinism is stable:

```bash
reachctl verify-determinism --n=5
```

Mismatched hashes are blocked by the `verify:oss` gate.

**CI Enforcement**: `npm run verify:oss` (required CI check; blocks merge)

### 5. Evidence-First

All new execution features must include:

1. An update to [`docs/EVIDENCE_CHAIN_MODEL.md`](docs/EVIDENCE_CHAIN_MODEL.md).
2. A new event type in [`protocol/schemas/events.schema.json`](protocol/schemas/events.schema.json) (if adding events).
3. A golden fixture in `testdata/fixtures/conformance/`.

### 6. Canonical Terminology in UI

All user-facing text must use approved terminology. Internal terms like "DAG", "MCP", "CID", "POEE", "topological sort", "vertex" must not appear in UI strings.

**CI Enforcement**: `npm run validate:language` (required CI check)

---

## Required Checks (All PRs)

These CI checks must pass before any PR can be merged:

| Check | Command | Blocks Merge |
| :--- | :--- | :--- |
| OSS Gate | `npm run verify:oss` | ✅ Yes |
| Language Enforcement | `npm run validate:language` | ✅ Yes |
| Import Boundaries | `npm run validate:boundaries` | ✅ Yes |
| OSS Purity | `npm run validate:oss-purity` | ✅ Yes |
| Rust Engine | `cargo clippy --workspace` + `cargo test -p engine-core` | ✅ Yes |
| Go Vet + Tests | `go vet ./...` + `go test ./...` | ✅ Yes |

---

## Reach Glossary

| Term | Definition |
| :--- | :--- |
| **Run** | A single execution of a pack with specific inputs. |
| **Determinism** | The property where identical inputs, policies, and artifacts ALWAYS produce identical output hashes. |
| **Replay** | The process of re-executing a Run from its event log to verify its fingerprint. |
| **Gate** | A policy evaluation point that can allow or deny execution. |
| **Artifact** | A versioned dependency or environment state used during a Run. |
| **Policy** | A set of rules (e.g., Rego) that governs execution behavior. |
| **Fingerprint** | The derived SHA-256 hash of a Run's event log and ID. |
| **Capsule** | A signed, portable bundle containing a Run's manifest and event log. |
| **Evidence Chain** | The cryptographically linked chain: Input → Policy → Artifacts → Execution → Output → Fingerprint. |
| **StorageDriver** | The interface that abstracts storage backends (SQLite in OSS, cloud object store in Enterprise). |

---

## Injection Protocol

When new constraints or skills are added:

1. Append the new capability or rule at the end of the relevant section.
2. Refine for clarity and remove duplication.
3. Preserve prior decisions unless superseded by verified improvements.
4. Update `Last Updated` date.

---

## Related Documents

- [`docs/BOUNDARIES.md`](docs/BOUNDARIES.md)
- [`docs/IMPORT_RULES.md`](docs/IMPORT_RULES.md)
- [`docs/DETERMINISM_SPEC.md`](docs/DETERMINISM_SPEC.md)
- [`docs/OSS_FIRST_COMPONENT_MAP.md`](docs/OSS_FIRST_COMPONENT_MAP.md)
- [`docs/ROADMAP_KILO_DETERMINISTIC_CI_GOVERNANCE.md`](docs/ROADMAP_KILO_DETERMINISTIC_CI_GOVERNANCE.md)
