# Blind-Spot Features (Bias-Caused)

## Coverage cross-reference (expected vs shipped)

| Persona | Expected feature | Current state | Evidence |
|---|---|---|---|
| Platform Engineer | Alerting + operational controls tied to real systems | Partial (real APIs in settings + static duplicate console pages) | [apps/arcade/src/app/settings/alerts/page.tsx](apps/arcade/src/app/settings/alerts/page.tsx), [apps/arcade/src/app/console/alerts/page.tsx](apps/arcade/src/app/console/alerts/page.tsx), [apps/arcade/src/components/stitch/console/pages/AlertsCenter.tsx](apps/arcade/src/components/stitch/console/pages/AlertsCenter.tsx) |
| Platform Engineer | Live trace exploration | Partial/mostly static in console surface | [apps/arcade/src/components/stitch/console/pages/TraceExplorer.tsx](apps/arcade/src/components/stitch/console/pages/TraceExplorer.tsx) |
| Security Reviewer | Audit workflow in UI | Hidden/partial (API exists; major UI surfaces static/mock) | [apps/arcade/src/app/api/v1/audit/route.ts](apps/arcade/src/app/api/v1/audit/route.ts), [apps/arcade/src/app/settings/advanced/security/page.tsx](apps/arcade/src/app/settings/advanced/security/page.tsx), [apps/arcade/src/app/governance/page.tsx](apps/arcade/src/app/governance/page.tsx) |
| Security Reviewer | Enterprise identity (SAML/SCIM) | Missing | [apps/arcade/src/app/api/v1/auth](apps/arcade/src/app/api/v1/auth), [apps/arcade/src/app/faq/page.tsx](apps/arcade/src/app/faq/page.tsx) |
| ML/AI Engineer | Reproducible run detail with real backend execution | Partial (simulated execution paths) | [apps/arcade/src/app/api/v1/workflows/[id]/runs/route.ts](apps/arcade/src/app/api/v1/workflows/[id]/runs/route.ts), [apps/arcade/src/app/api/v1/playground/route.ts](apps/arcade/src/app/api/v1/playground/route.ts) |
| CTO / VP Eng | Enterprise controls matching claims | Partial/misaligned claims | [apps/arcade/src/app/enterprise/page.tsx](apps/arcade/src/app/enterprise/page.tsx), [apps/arcade/src/app/faq/page.tsx](apps/arcade/src/app/faq/page.tsx) |
| OSS Maintainer | Single source of docs truth | Fragmented | [apps/docs](apps/docs), [apps/arcade/src/app/docs](apps/arcade/src/app/docs), [docs](docs) |
| Non-technical Stakeholder | Self-serve status + reporting + change narrative | Partial/static | [apps/arcade/src/app/support/status/page.tsx](apps/arcade/src/app/support/status/page.tsx), [apps/arcade/src/app/changelog/page.tsx](apps/arcade/src/app/changelog/page.tsx), [docs/QUICKSTART_NON_TECH.md](docs/QUICKSTART_NON_TECH.md) |
| All personas | Stable navigation | Partial (dead links in live nav) | [apps/arcade/src/app/cloud/layout.tsx](apps/arcade/src/app/cloud/layout.tsx), [apps/arcade/src/lib/routes.ts](apps/arcade/src/lib/routes.ts) |
| All personas | API-key lifecycle in UI | Hidden/partial (API real, UI demo data) | [apps/arcade/src/app/api/v1/api-keys/route.ts](apps/arcade/src/app/api/v1/api-keys/route.ts), [apps/arcade/src/app/settings/api-keys/page.tsx](apps/arcade/src/app/settings/api-keys/page.tsx) |

---

## Category A — Hygiene features (should obviously exist)

### A1. Real API key management UI (not demo table)
- Description: Wire create/revoke/list key flows in settings with one-time key reveal and rotation UX.
- Persona: Platform Engineer, Security Reviewer.
- Why missing (likely bias): Backend-first completion counted as done; UI rigor deprioritized.
- Impact if absent: Security workflows happen outside product; trust loss.
- Priority: P0.
- Surface: Cloud.
- Minimal scope: Replace demo key state in [settings/api-keys](apps/arcade/src/app/settings/api-keys/page.tsx) with `/api/v1/api-keys` GET/POST/DELETE.

### A2. Audit log viewer with filters/export
- Description: Tenant audit table with search, actor/action/resource filters, and CSV export.
- Persona: Security Reviewer, CTO.
- Why missing: Compliance narrative favored over reviewer workflow.
- Impact if absent: Audit evidence is technically present but operationally unusable.
- Priority: P0.
- Surface: Cloud/Hybrid.
- Minimal scope: New page using `/api/v1/audit`; link from security/governance/settings.

### A3. Nav integrity gate + route cleanup
- Description: Prevent shipping links to missing pages.
- Persona: All.
- Why missing: Architecture mapping outran product completion.
- Impact if absent: Broken journeys and perceived instability.
- Priority: P0.
- Surface: Local/Cloud.
- Minimal scope: CI check against [routes.ts](apps/arcade/src/lib/routes.ts) + [cloud/layout.tsx](apps/arcade/src/app/cloud/layout.tsx); remove or implement dead links.

---

## Category B — Trust builders (enterprise expectations)

### B1. Enterprise identity baseline (SAML SSO + SCIM) or hard claim downgrade
- Description: Either implement SAML/SCIM minimum or remove claim-level language.
- Persona: Security Reviewer, CTO.
- Why missing: Compliance signaling bias.
- Impact if absent: Security diligence failure and stalled procurement.
- Priority: P0.
- Surface: Cloud.
- Minimal scope: SAML login + SCIM user provisioning endpoints + docs parity; otherwise immediate marketing/docs correction.

### B2. Signed compliance export bundle
- Description: One-click export of audit events, policy versions, gate results, and signature hashes.
- Persona: Security Reviewer.
- Why missing: Evidence primitives built, reviewer package flow not built.
- Impact if absent: Manual evidence assembly increases audit cost and risk.
- Priority: P1.
- Surface: Cloud/Hybrid.
- Minimal scope: Export endpoint + verification manifest + downloadable archive.

### B3. Incident communications workflow
- Description: Public status updates, incident subscriptions, and postmortem links sourced from real incidents.
- Persona: CTO, Non-technical stakeholder.
- Why missing: Internal runbook thinking over external communication UX.
- Impact if absent: Low confidence during outages.
- Priority: P1.
- Surface: Cloud.
- Minimal scope: Incident model + status subscriptions + status page backed by real incidents.

---

## Category C — Adoption accelerators (friction reducers)

### C1. Server-side onboarding state and first-success continuity
- Description: Persist onboarding progress in backend, not browser localStorage only.
- Persona: CTO, Platform Engineer, Non-technical stakeholder.
- Why missing: Local-first bias.
- Impact if absent: Cross-device/team onboarding breaks and conversion drops.
- Priority: P1.
- Surface: Cloud.
- Minimal scope: Read/write onboarding progress API + migrate dashboard checklist state.

### C2. Integration setup wizard with connection tests
- Description: Guided integration install (GitHub, webhook, Slack/PagerDuty via webhook templates) with validation.
- Persona: Platform Engineer.
- Why missing: UI polish on mock integration cards instead of setup completion.
- Impact if absent: Time-to-value stalls at integration step.
- Priority: P1.
- Surface: Cloud.
- Minimal scope: Replace static integration cards with live integration states + test action.

### C3. Live API reference generated from real endpoints
- Description: Docs API pages should reflect actual routes/schemas, with request examples that run.
- Persona: OSS Maintainer, Platform Engineer.
- Why missing: Documentation drift and dual-doc-system bias.
- Impact if absent: Integration errors and support burden.
- Priority: P1.
- Surface: Local/Cloud.
- Minimal scope: Generate from route contracts/OpenAPI; remove stale fictional endpoints.

---

## Category D — Defensive features (risk mitigation)

### D1. Policy/gate rollback control
- Description: Revert to prior policy/gate versions with auditable reason.
- Persona: Platform Engineer, Security Reviewer.
- Why missing: Replay/integrity primitives prioritized over operational rollback UX.
- Impact if absent: Prolonged incidents and risky manual remediation.
- Priority: P0.
- Surface: Cloud/Hybrid.
- Minimal scope: Version snapshots + “rollback to previous known-good” action + audit entry.

### D2. Approval workflow for high-impact governance changes
- Description: Human approval queue for enforce/freeze/high-risk policy changes.
- Persona: Security Reviewer, CTO.
- Why missing: Governance semantics prioritized over governance operations.
- Impact if absent: Single-admin blast radius remains high.
- Priority: P1.
- Surface: Cloud.
- Minimal scope: Approval state machine + approver assignment + timeout/escalation.

### D3. Alert delivery reliability visibility
- Description: Delivery logs, retries, and dead-letter view for alerts/webhooks.
- Persona: Platform Engineer.
- Why missing: Alert dispatch exists in backend but no operator visibility layer.
- Impact if absent: Silent alert failures during incidents.
- Priority: P1.
- Surface: Cloud.
- Minimal scope: Persist dispatch outcomes + UI delivery history table.

---

## Category E — Visibility & observability gaps

### E1. Real trace explorer connected to run data
- Description: Replace static timeline with queryable traces and deep links from reports/alerts.
- Persona: Platform Engineer, ML Engineer.
- Why missing: Demo visualization favored over live operational tooling.
- Impact if absent: Slow mean-time-to-understand failures.
- Priority: P0.
- Surface: Cloud/Hybrid.
- Minimal scope: Trace list API + trace detail model + filters/search.

### E2. Monitoring trends and SLO burn visualization
- Description: Trend charts for drift/latency/error and budget burn by signal.
- Persona: Platform Engineer, CTO.
- Why missing: Snapshot card bias over operational trend analysis.
- Impact if absent: Reactive operations; no early warning.
- Priority: P1.
- Surface: Cloud.
- Minimal scope: Query rollups + charting + severity thresholds.

### E3. One-click "what failed?" explainer path
- Description: From failed report -> exact failing rule/tool/input delta -> suggested action.
- Persona: ML Engineer, Platform Engineer.
- Why missing: Replay/proof depth over remediation UX.
- Impact if absent: Engineers leave product to debug manually.
- Priority: P0.
- Surface: Local/Cloud/Hybrid.
- Minimal scope: Failure explanation composer attached to report artifacts.

---

## Category F — Governance usability gaps

### F1. Role editor with scoped custom roles
- Description: Manage role templates and resource-level permissions in UI.
- Persona: Security Reviewer, Platform Engineer.
- Why missing: RBAC enforcement exists but admin ergonomics is underbuilt.
- Impact if absent: Role governance remains code/manual DB work.
- Priority: P1.
- Surface: Cloud.
- Minimal scope: CRUD for roles + permission matrix + inheritance rules.

### F2. Policy impact simulator (dry-run)
- Description: Show what a policy change would block/allow before enforcement.
- Persona: Security Reviewer, ML Engineer.
- Why missing: Deterministic compiler emphasis without operator preview UX.
- Impact if absent: Fear-driven reluctance to enforce policies.
- Priority: P1.
- Surface: Cloud/Hybrid.
- Minimal scope: Replay recent runs against proposed policy and summarize delta.

### F3. Surface existing enterprise governance analytics
- Description: Expose `/api/v1/governance/enterprise/analytics` in console.
- Persona: CTO, Security Reviewer.
- Why missing: Backend done, UI never productized.
- Impact if absent: Enterprise plan value is invisible.
- Priority: P1.
- Surface: Cloud.
- Minimal scope: Analytics panel with workspace selector and trend cards.

---

## Category G — "Too boring to build" features

### G1. Scheduled executive reporting (email/PDF/CSV)
- Description: Weekly/monthly digest for risk, drift, incidents, spend, and compliance deltas.
- Persona: CTO, Non-technical stakeholder.
- Why missing: Engineering elegance bias; viewed as non-core.
- Impact if absent: Leadership cannot consume value without analyst mediation.
- Priority: P0.
- Surface: Cloud.
- Minimal scope: Scheduled job + template + distribution list.

### G2. Reality-based changelog pipeline
- Description: Generate changelog from shipped features/flags/migrations, not static curated cards.
- Persona: OSS Maintainer, CTO.
- Why missing: Narrative control bias.
- Impact if absent: Release trust erodes.
- Priority: P1.
- Surface: Local/Cloud.
- Minimal scope: Release metadata extractor + approval step + publish.

### G3. Ownership and runbook links per signal/gate
- Description: Every monitor/gate has owner, escalation contact, and runbook URL.
- Persona: Platform Engineer, Non-technical stakeholder.
- Why missing: Model/governance depth over incident boring basics.
- Impact if absent: Slow coordination in outages.
- Priority: P0.
- Surface: Cloud/Hybrid.
- Minimal scope: Add fields + enforce at create/edit + display in alert/report views.

---

## Pattern-level diagnosis
Most blind spots are not missing because they are hard. They are missing because they are **operationally boring** and don’t satisfy the current internal prestige axis (determinism proofs, boundary purity, architecture narratives).
