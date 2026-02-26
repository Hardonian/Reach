# Reach Primary Customer Personas

## Derived from Repository Evidence

---

## Persona 1: Platform Engineer / DevEx Lead

**Evidence Sources**:

- README.md (CLI installation instructions)
- docs/QUICKSTART_TECH.md
- apps/arcade/src/app/page.tsx ("Install OSS CLI" CTA)

### Primary Job-to-be-Done

Install and operationalize Reach across the development lifecycle, ensuring deterministic execution is available for all AI-driven workflows.

### Moment of Value

First successful `reach doctor` → `reach demo` → `reach capsule verify` within 60 seconds.

### Required Product Surfaces

| Surface               | Current Status                   | Gap                                            |
| --------------------- | -------------------------------- | ---------------------------------------------- |
| CLI install page      | EXISTS (docs/INSTALL.md)         | Partial - needs clearer package manager matrix |
| `reach doctor`        | EXISTS                           | Works                                          |
| `reach quickstart`    | EXISTS                           | Works                                          |
| Troubleshooting guide | EXISTS (docs/troubleshooting.md) | Needs expansion                                |
| CI integration guide  | PARTIAL                          | Missing GitHub Actions deep-dive               |

---

## Persona 2: Security / Compliance Officer

**Evidence Sources**:

- docs/compliance/determinism-soc2-mapping.md
- docs/security/security-posture.md
- docs/whitepapers/deterministic-governance.md

### Primary Job-to-be-Done

Validate that AI governance meets audit requirements with cryptographic proof of decision integrity.

### Moment of Value

Viewing a complete audit chain from intent → execution → proof with SOC2 control mapping.

### Required Product Surfaces

| Surface                  | Current Status              | Gap                                   |
| ------------------------ | --------------------------- | ------------------------------------- |
| SOC2 mapping doc         | EXISTS                      | Complete                              |
| Security posture page    | EXISTS                      | Complete                              |
| Audit trail viewer       | PARTIAL                     | Console exists but needs polish       |
| Proof verification       | EXISTS (reach proof verify) | Works                                 |
| Compliance report export | MISSING                     | PDF/compliance artifact export needed |

---

## Persona 3: ML/AI Engineer (Evals & Replay)

**Evidence Sources**:

- DETERMINISM_ROADMAP.md (cross-verification)
- docs/internal/REPLAY_PROTOCOL.md
- docs/CONCEPT_MAP.md

### Primary Job-to-be-Done

Debug model behavior with deterministic replay and compare eval runs with guaranteed consistency.

### Moment of Value

Replaying a failed run and seeing identical output on second execution, with diff capability.

### Required Product Surfaces

| Surface                    | Current Status | Gap                                       |
| -------------------------- | -------------- | ----------------------------------------- |
| `reach replay`             | EXISTS         | Works                                     |
| `reach diff-run`           | EXISTS         | Works                                     |
| `reach verify-determinism` | EXISTS         | Works                                     |
| Replay visualization       | PARTIAL        | Console pages exist but could be enhanced |
| Eval comparison dashboard  | MISSING        | Side-by-side eval run comparison UI       |

---

## Persona 4: Engineering Manager / CTO

**Evidence Sources**:

- apps/arcade/src/app/enterprise/page.tsx
- README.md (Enterprise features mention)
- docs/launch/SERIES_A_NARRATIVE.md

### Primary Job-to-be-Done

Understand risk posture of AI deployments and justify Reach investment with compliance ROI.

### Moment of Value

Dashboard showing governance coverage across all projects with clear audit trail.

### Required Product Surfaces

| Surface                       | Current Status   | Gap                           |
| ----------------------------- | ---------------- | ----------------------------- |
| Enterprise page               | EXISTS           | Complete                      |
| Pricing page                  | EXISTS           | Complete                      |
| ROI calculator                | MISSING          | Interactive cost/benefit tool |
| Executive summary report      | PARTIAL          | Needs one-page PDF generator  |
| Governance coverage dashboard | EXISTS (console) | Works but needs polish        |

---

## Persona 5: Open Source Contributor / Community Member

**Evidence Sources**:

- CONTRIBUTING.md
- docs/contrib/\*
- GitHub issues/labels

### Primary Job-to-be-Done

Contribute to the deterministic execution ecosystem and extend Reach capabilities.

### Moment of Value

Successful first PR with deterministic tests passing and clear contribution pathway.

### Required Product Surfaces

| Surface                 | Current Status | Gap            |
| ----------------------- | -------------- | -------------- |
| Contributing guide      | EXISTS         | Complete       |
| Good first issues       | EXISTS         | Documented     |
| PR guidelines           | EXISTS         | Complete       |
| Dev setup docs          | EXISTS         | Complete       |
| Community Discord/Slack | UNKNOWN        | Not documented |

---

## Cross-Persona Critical Paths

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        REACH ADOPTION FUNNEL                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  Discovery   │───▶│  First Run   │───▶│  Production  │              │
│  │  (All)       │    │  (Platform)  │    │  (Security)  │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│        │                   │                   │                       │
│        ▼                   ▼                   ▼                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │ Homepage     │    │ reach doctor │    │ CI Gates     │              │
│  │ /playground  │    │ reach demo   │    │ SOC2 proofs  │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Priority Persona Ranking

1. **Platform Engineer** - Critical path for adoption
2. **Security/Compliance Officer** - Enterprise revenue driver
3. **ML/AI Engineer** - Technical validation and depth
4. **Engineering Manager/CTO** - Budget and expansion
5. **OSS Contributor** - Ecosystem growth
