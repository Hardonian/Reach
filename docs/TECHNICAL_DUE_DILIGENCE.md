# Reach Pre-Series A Technical Due Diligence ## Scoring legend

- **PASS**: production-grade baseline exists with low immediate execution risk.
- **PARTIAL**: foundation exists but maturity or controls are incomplete.
- **GAP**: material deficiency likely to block enterprise adoption or scaling.

## Executive scorecard | Area | Score | Notes |
|---|---|---|
| Architecture scalability | PARTIAL | Multi-service split exists, but SQLite-centric runner storage and limited horizontal scaling evidence. |
| Determinism guarantees | PARTIAL | Deterministic replay invariants and tests exist; cryptographic provenance and full-system determinism envelope still maturing. |
| CI/CD maturity | PARTIAL | Strong lint/typecheck/build/test scripts; release gating appears CLI-driven without explicit staged deployment controls in-repo. |
| Spec completeness | PASS | Multiple protocol/spec documents and version compatibility checks are present. |
| Dependency risk | PARTIAL | Multi-ecosystem footprint raises maintenance load; no in-repo automated vuln-report artifact observed. |
| Observability maturity | PARTIAL | Health/metrics endpoints and audit tooling exist; full distributed tracing/alerting posture not evidenced in repo. |
| Test coverage | PARTIAL | Targeted unit/invariant tests are present; broad coverage metrics and end-to-end chaos suites are limited. |
| Governance clarity | PARTIAL | SECURITY and CONTRIBUTING exist; CLA/DCO and license metadata consistency require cleanup. |

---

## 1) Architecture scalability — PARTIAL ### Evidence

- Service decomposition across runner/session-hub/integration-hub/connector-registry, plus Rust engine core.
- Durable queue and jobs abstractions in runner.
- Current runner persistence path uses SQLite store operations.

### Diligence interpretation The architecture is directionally scalable (modular boundaries, delegated execution, queueing), but database and operational assumptions in OSS runner path imply early-stage scale profile.

### Readiness actions - Define a production database strategy and migration path.
- Publish target throughput/SLO envelopes and load-test artifacts.

---

## 2) Determinism guarantees — PARTIAL ### Evidence

- Deterministic event and replay invariants in `engine-core`.
- Snapshot guard rejects mismatch.
- Federation compatibility and replay-related tests exist.

### Diligence interpretation Core deterministic primitives are present, but strict proof chain from pack signature -> policy version -> runtime environment -> replay artifact is not yet cryptographically end-to-end.

### Readiness actions - Introduce signed attestations binding pack, policy version, registry hash, and run outputs.
- Add deterministic seeding/time-source controls at every executor boundary.

---

## 3) CI/CD maturity — PARTIAL ### Evidence

- Standardized scripts for lint/typecheck/test/build and full verification.
- Release-check helper exists in CLI.

### Diligence interpretation Verification discipline is good for repository quality. Missing in-repo evidence includes staged environment promotion gates, SLSA provenance, and policy-enforced release attestations.

### Readiness actions - Add build provenance generation and signature verification in CI.
- Document promotion workflow dev -> staging -> production.

---

## 4) Spec completeness — PASS ### Evidence

- Dedicated specs for execution protocol, federated execution, run replay, pack signing, and model routing.
- Runner spec compatibility checker enforces major-version contract.

### Diligence interpretation Spec surface is unusually explicit for stage, and there is code-level enforcement for critical compatibility gates.

### Readiness actions - Add conformance test matrix mapping each spec MUST/SHOULD to tests.

---

## 5) Dependency risk — PARTIAL ### Evidence

- Polyglot stack (Rust/Go/Node) with multiple manifests.
- Lockfiles present for Rust and npm root.

### Diligence interpretation Stack diversity improves flexibility but expands vuln/license operational burden. Automated SBOM + continuous vulnerability diffing should be formalized.

### Readiness actions - Publish SBOM for each release.
- Add policy gate for critical CVEs in CI.

---

## 6) Observability maturity — PARTIAL ### Evidence

- Health endpoints and Prometheus-style metrics path in services.
- Audit retrieval and inspection tooling exists for runner.

### Diligence interpretation Baseline telemetry exists, but enterprise-grade distributed tracing, SLO dashboards, and incident playbooks are not evidenced in repository docs.

### Readiness actions - Add tracing context propagation and retention policies.
- Publish oncall runbooks and incident severity matrix.

---

## 7) Test coverage — PARTIAL ### Evidence

- Invariant and compatibility tests in engine-core.
- Runner API/queue/module tests exist.

### Diligence interpretation Quality signals are positive, but coverage appears component-centric. Cross-service end-to-end failure injection and long-horizon replay/federation drift tests are next maturity step.

### Readiness actions - Add nightly integration suites for federation + replay + policy lifecycle.
- Track code coverage trend and enforce floors for critical paths.

---

## 8) Governance clarity — PARTIAL ### Evidence

- README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY present.
- Added NOTICE file for downstream clarity.

### Diligence interpretation Governance baseline exists. Legal/compliance governance (CLA/DCO, licensing consistency) should be tightened before institutional procurement.

### Readiness actions - Formalize CLA/DCO and release governance checklist.
- Align all package-level license metadata to top-level policy.

---

## Overall diligence readiness - **Composite readiness**: **PARTIAL (6/8 areas partial, 1 pass, 0 hard gaps)**
- **Investor framing**: strong technical direction and security-aware architecture with clear path to enterprise hardening.
- **Top three near-term priorities**:
  1. Cryptographic provenance and audit immutability enhancements.
  2. Production scaling posture (data plane and load evidence).
  3. Compliance/governance formalization (license/IP and release attestations).
