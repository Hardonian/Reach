# Reach Legal Risk Surface Audit

## Objective

Assess legal and compliance exposure in the current Reach OSS repository for investor and enterprise diligence readiness.

## Evidence reviewed

- `LICENSE` (Apache-2.0 text)
- `README.md` licensing statement
- `SECURITY.md` disclosure policy
- `CONTRIBUTING.md` contribution process
- Build/service manifests across Rust, Go, and Node ecosystems

---

## 1) OSS license clarity

### Current state

- Repository includes Apache License 2.0 text in `LICENSE`.
- README states Apache License 2.0 explicitly.
- Cargo workspace metadata still declares `MIT` as workspace package license.

### Risk

**PARTIAL** — Potential license ambiguity between repository-level Apache-2.0 and Rust workspace metadata MIT declaration can create downstream compliance confusion.

### Recommendation

- Align `Cargo.toml [workspace.package].license` with repository top-level license decision.
- Add a short license policy note in `CONTRIBUTING.md` stating all contributions are accepted under repo LICENSE terms.

---

## 2) Contributor IP ownership / assignment

### Current state

- Contribution guidelines exist but no CLA/DCO policy is declared.

### Risk

**PARTIAL** — Absent CLA or explicit DCO sign-off, provenance assurances for contributor IP are weaker for financing and enterprise procurement.

### Recommendation

- Adopt either DCO sign-off requirement or CLA workflow.
- Add explicit statement that contributors represent right to submit code under repository license.

---

## 3) Security disclosure policy

### Current state

- `SECURITY.md` defines private reporting channel, expected report content, and non-public disclosure guidance.

### Risk

**PASS** — Baseline coordinated disclosure policy exists and is actionable.

### Recommendation

- Add target initial response SLA and remediation communication cadence.

---

## 4) Hosted deployment liability

### Current state

- README distinguishes OSS self-hosted vs hosted deployments, but there is no dedicated hosted terms or SLA/legal boundary doc in repo.

### Risk

**PARTIAL** — If commercial hosted offering exists, liability allocation, data processing roles, incident notification duties, and uptime commitments are not formalized here.

### Recommendation

- Maintain separate hosted legal pack (ToS, DPA, SLA, subprocessors) for managed offerings.
- Ensure open-source docs clearly state no warranty and user-operated risk where relevant.

---

## 5) Export control exposure

### Current state

- Cryptographic features are used (signature verification, hashing), but no export-control statement is included.

### Risk

**PARTIAL** — For international distribution and enterprise procurement, explicit export classification guidance may be requested.

### Recommendation

- Add an export/compliance note (e.g., “contains cryptography; users must comply with local laws”).
- Maintain jurisdictional screening process for hosted services if applicable.

---

## 6) Economic model liability (token-based)

### Current state

- No token issuance/economic instrument implementation is present in this repository.

### Risk

**PASS (Not Applicable currently)** — No direct token/securities risk surface identified in present code/docs.

### Recommendation

- Reassess immediately if tokenized incentives, staking, or revenue-sharing instruments are introduced.

---

## Required governance artifacts check

- `LICENSE`: **Present**.
- `SECURITY.md`: **Present**.
- `NOTICE`: **Added** in this change set to support Apache-style attribution packaging discipline for downstream redistributors.

---

## Legal posture summary

- **Strengths**: clear top-level license file, established security disclosure process.
- **Primary gaps**: contributor IP provenance mechanism (CLA/DCO), license metadata alignment across manifests, and hosted/export legal overlays.
- **Overall status**: **PARTIAL / investable with remediation plan**.
