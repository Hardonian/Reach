# Persona Expectation Model

This models what each persona expects by default in 2026, not what Reach prefers to emphasize.

## 1) Platform Engineer

### Platform Engineer: Expects without being told

- One place to see live system health, incidents, queue pressure, and failing runs.
- Fast root-cause trail from alert -> run -> trace -> fix.
- Rollback controls for gates/policies/configs.
- API + CLI parity for every operational action.

### Platform Engineer: "Standard" modern baseline

- Alert routing to Slack/PagerDuty/Teams with suppression/dedupe controls.
- Real-time dashboards with trends/SLO burn rates.
- Integration setup checks (GitHub/webhook validity, auth tests).
- Stable nav with no dead routes.

### Platform Engineer: Frustration if missing

- Pretty console cards with mock data.
- Control pages that do not mutate real state.
- Route sprawl and duplicate surfaces (same concept in multiple places, inconsistent behavior).

## 2) Security / Compliance Reviewer

### Security Reviewer: Expects without being told

- Verifiable audit access in UI (filter, export, immutable evidence chain).
- Role and permission model that is enforceable and inspectable.
- Incident workflow + postmortem traceability.
- Enterprise identity controls (SAML/SSO + SCIM lifecycle if enterprise is claimed).

### Security Reviewer: "Standard" modern baseline

- Policy simulation before enforcement.
- Approval workflows for high-risk changes.
- Compliance report generation backed by real records (not static docs claims).

### Security Reviewer: Frustration if missing

- Compliance marketing claims with no corresponding workflow.
- Audit logs available by API but not truly reviewable by non-engineers.
- Security settings that are static UI samples.

## 3) ML / AI Engineer

### ML / AI Engineer: Expects without being told

- Clear model/prompt drift visibility with baseline comparison.
- Experiment tracking and reproducible run diffing.
- Fast "what changed and why did this fail" UX.
- Confidence that evaluation data is real, not canned.

### ML / AI Engineer: "Standard" modern baseline

- Side-by-side run comparisons.
- Dataset/version lineage.
- Easy scenario simulation with explicit threshold tuning.

### ML / AI Engineer: Frustration if missing

- Simulated or canned execution paths in core workflows.
- Hard to connect findings to concrete model/tool config diffs.
- No concise failure explainability path from console.

## 4) CTO / VP Engineering

### CTO / VP Engineering: Expects without being told

- Executive-ready risk/cost/reliability views.
- Evidence that adoption can scale across teams quickly.
- Predictable onboarding and time-to-first-value.
- Credible enterprise controls matching sales claims.

### CTO / VP Engineering: "Standard" modern baseline

- Portfolio-level reporting and trend exports.
- Incident and change narratives that non-operators can consume.
- Contract-level reliability evidence (SLA/SLO reporting).

### CTO / VP Engineering: Frustration if missing

- Architecture-heavy story with weak business controls.
- No consistent narrative from marketing -> product -> docs.
- Discovery that key enterprise controls are partial/hidden.

## 5) OSS Maintainer

### OSS Maintainer: Expects without being told

- Clear OSS-vs-enterprise boundary with minimal confusion.
- Straightforward local setup + non-flaky verification path.
- Honest capability matrix (what is demo vs production).
- Contribution paths tied to visible product gaps.

### OSS Maintainer: "Standard" modern baseline

- Docs that match running surfaces.
- API references generated from live contracts.
- Fewer duplicate docs surfaces to reduce drift.

### OSS Maintainer: Frustration if missing

- Heavy governance doctrine while basic UX remains unfinished.
- Inconsistent docs/apps with competing truth sources.
- Verifier depth that outpaces day-1 contributor clarity.

## 6) Non-technical Stakeholder

### Non-technical Stakeholder: Expects without being told

- Simple, trustworthy status: Are we safe? Are we compliant? Are we improving?
- Human-readable weekly/monthly summaries.
- Shareable reports with context and recommended action.
- Clear ownership/escalation when something is red.

### Non-technical Stakeholder: "Standard" modern baseline

- Email digest or scheduled report.
- Incident timeline with business impact summary.
- Clear approvals and accountability trail in plain language.

### Non-technical Stakeholder: Frustration if missing

- Too much jargon (determinism/governance internals) without outcome framing.
- Dashboards that look technical but do not answer decision questions.
- No self-serve non-technical onboarding path in primary product UI.

## Cross-persona expectation themes

- Observability must be actionable, not decorative.
- Audit/compliance must be reviewable, not just claimable.
- Rollback and incident controls must exist as first-class workflows.
- RBAC/identity must match enterprise claims.
- Notifications/reporting/change logs must be usable by non-engineering stakeholders.
- API access is necessary but insufficient if UI does not surface it clearly.
