# Reach — Antigravity Local Kimi Prompt

MODEL: Kimi (Antigravity local)
MODE: Bias-Closure Implementation Engine (No-Theater)
ENV: Full repo access, run commands, modify files, verify green

INPUTS (MUST READ FIRST)
- `/mnt/c/Users/scott/Documents/GitHub/Reach/BIAS_PATTERNS.md`
- `/mnt/c/Users/scott/Documents/GitHub/Reach/PERSONA_EXPECTATION_MODEL.md`
- `/mnt/c/Users/scott/Documents/GitHub/Reach/BLIND_SPOT_FEATURES.md`
- `/mnt/c/Users/scott/Documents/GitHub/Reach/ANTI_BIAS_PRIORITY_TABLE.md`

MISSION
Close all critical blind spots identified in the above docs by implementing production-grade features and claim parity changes in this repo.

This is not a brainstorm.
This is not a UI mock exercise.
This is code + wiring + verification.

NON-NEGOTIABLE RULES
1. Preserve determinism/replay hashing semantics. No changes to determinism contracts.
2. Preserve OSS/Enterprise boundaries (no forbidden cross-imports).
3. No nav-to-nowhere links for touched surfaces.
4. No hard-500 routes in touched areas (loading/empty/error states required).
5. If enterprise claims exceed shipped functionality, either:
   - implement minimum viable feature, or
   - downgrade claim language immediately (no theater).
6. Prefer extending existing routes/components over creating duplicates.
7. Every shipped claim must be traceable to implemented behavior.

SUCCESS DEFINITION
- P0/launch-critical anti-bias items are implemented and verified.
- P1 items with existing backend capability are surfaced in UI.
- Remaining high-effort items are either partially shipped with safe fallbacks or claims are corrected.
- Verification suite passes (or failures documented with exact repro and root cause).

================================================================================
PHASE 0 — BASELINE + INVENTORY
================================================================================
1) Detect workspace layout and app boundaries.
2) Run baseline checks (record before/after):
   - `npm run lint` (or workspace equivalent)
   - `npm run typecheck`
   - `npm run test`
   - `npm run verify:routes`
   - `npm run verify:oss`
   - `npm run verify:boundaries`
3) Generate inventory of:
   - marketing nav/routes
   - cloud/app/console nav/routes
   - docs nav/routes
   - dead links / missing route targets

OUTPUT
- Baseline pass/fail table.
- Route/nav gap list.

================================================================================
PHASE 1 — P0 CREDIBILITY FIXES (MUST SHIP)
================================================================================
Implement these in order.

A) Route/Nav Integrity (P0)
- Remove or implement dead links in live navigation.
- Add/extend guard verification to fail CI on nav-to-missing-page regressions.
- Ensure route constants reflect real surface.

B) Real API Key Lifecycle UI (P0)
- Replace demo/static API keys page with real data from `/api/v1/api-keys`.
- Implement: list, create, revoke, one-time raw-key reveal UX, proper empty/error states.
- Respect RBAC and server errors.

C) Audit Workflow UI (P0)
- Add/upgrade UI to consume `/api/v1/audit` with:
  - filtering/search
  - pagination/limit
  - export (CSV minimum)
  - actor/action/resource visibility
- Link from security/governance/settings surfaces.

D) “What failed?” Explain Path (P0)
- From report/failure surface, provide direct structured root-cause panel:
  - failing rule/check
  - impacted run/trace context
  - concrete fix recommendation
- Must be actionable without reading long docs.

E) Policy/Gate Rollback Control (P0)
- Add version-aware rollback path for policy/gate config.
- Require reason-for-change capture.
- Audit every rollback event.

F) Ownership Metadata (P0)
- For monitors/gates: require `owner`, `escalation_contact`, `runbook_url`.
- Show metadata in alert/report details.

OUTPUT
- File-level change summary for A–F.
- Explicit behavior demo steps.

================================================================================
PHASE 2 — ENTERPRISE TRUST PARITY (P0/P1)
================================================================================
A) Identity Claims Parity
- Evaluate enterprise identity claims in marketing/docs/FAQ.
- If SAML/SCIM is not implemented now:
  - downgrade claims precisely and consistently across surfaces.
- If implementing now:
  - ship minimal SAML SSO + SCIM endpoints + docs wiring + RBAC alignment.

B) Surface Existing Enterprise Analytics
- If backend exists (e.g. governance enterprise analytics), expose it in UI.
- Add empty/error/loading states and entitlement gating messages.

C) Signed Compliance Export Bundle (P1)
- Export audit/policy/gate evidence with integrity metadata.
- Minimum: downloadable bundle + manifest + timestamps + tenant scope.

OUTPUT
- Claim-parity diff list (before -> after).
- Implemented endpoints/pages for trust parity.

================================================================================
PHASE 3 — OPERATOR UX CLOSURES (P1)
================================================================================
A) Real Trace Explorer
- Replace static trace timeline with live data-backed explorer.
- Filter/search by trace/run/agent/status.
- Deep-link from reports and alerts.

B) Integration Setup Wizard
- Replace static integration cards with live setup/test flow.
- Minimum supported path: webhook + GitHub integration validation.
- Show connection health and last delivery outcomes.

C) Alert Delivery Reliability Ledger
- Persist alert dispatch outcomes.
- Expose retries/failures/dead-letter view in UI.

D) Server-side Onboarding Persistence
- Migrate onboarding progress from localStorage-only to server-backed state.
- Preserve backward compatibility for existing users.

E) Scheduled Executive Reporting (minimum)
- Add scheduled digest generation (email/export) for risk/drift/incident summary.
- If not fully schedulable, ship manual “Generate executive report” with saved artifacts.

OUTPUT
- Implemented UX closure map with routes and APIs touched.

================================================================================
PHASE 4 — CLAIMS/ DOCS / PRODUCT CONSISTENCY
================================================================================
1) Remove stale or fictional endpoint references from docs/app docs.
2) Ensure docs API references align with real routes/schemas.
3) Ensure changelog reflects actual shipped behavior (no aspirational entries).
4) Ensure OSS-vs-enterprise boundaries are explicit and consistent.

OUTPUT
- Claim matrix update:
  - claim
  - source file
  - backed by code? (Y/N)
  - action taken (implemented / downgraded)

================================================================================
PHASE 5 — HARDENING + SAFETY
================================================================================
For every touched route/page:
- Add loading state.
- Add empty state.
- Add error fallback.
- Ensure no hard 500 for expected missing-data scenarios.

For every touched mutation:
- input validation
- auth/role checks
- audit logging where sensitive

================================================================================
PHASE 6 — VERIFICATION + SMOKE
================================================================================
Run full verification and report results:
- lint
- typecheck
- tests
- build
- verify:routes
- verify:oss
- verify:boundaries

HTTP smoke (must not 500):
- `/`
- one marketing subpage
- `/app` (or gate/redirect but no 500)
- every newly touched route
- key APIs touched in this effort

================================================================================
PHASE 7 — FINAL REPORT (MANDATORY)
================================================================================
Return in chat:
1) Files changed, grouped:
   - routes/nav
   - UI/components
   - APIs/backend
   - docs/claims
   - verification scripts
2) Executive-summary item closure table:
   - item
   - status (Shipped / Partially Shipped / Claim Downgraded / Blocked)
   - evidence (file paths)
3) Bias-pattern mitigation mapping:
   - bias pattern
   - mitigation implemented
4) Persona impact mapping:
   - persona
   - new capability now available
5) Verification commands + pass/fail outputs.
6) Smoke route results with status codes.
7) If not GREEN, list blockers with exact repro commands and minimal patch plan.

STOP CONDITION
Do not stop at analysis. Implement and verify until GREEN, or provide exact blockers with code-level evidence.
