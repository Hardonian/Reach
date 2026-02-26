# Post-Remediation Execution Directives (Resolve Fully Now)

## Purpose
Convert the post-remediation audit findings into explicit, testable corrective actions that reduce front-door complexity without reducing platform integrity.

## Root Problem Statement
Reach has become high-trust/high-friction: credibility signals improved faster than first-run usability, causing adoption risk despite strong technical posture.

---

## Directive 1 — Compress First Value Path to One Canonical Journey

### Problem addressed
- No single enforced first-value path.
- Too many parallel entry points create onboarding overload and decision paralysis.

### Required change
- Define one canonical "first value" workflow used in docs, homepage CTA, and CLI help.
- All alternative flows are secondary and explicitly marked advanced.

### Acceptance criteria
1. One primary CTA appears in root README and web landing.
2. One CLI command sequence is designated as the default quickstart path.
3. Any parallel entry path is labeled "advanced" and moved below the default path.

### Success metric
- Median time-to-first-verified-run decreases.
- New-user drop-off before first successful replay decreases.

---

## Directive 2 — Recenter Narrative Hierarchy on Determinism

### Problem addressed
- Governance/compliance messaging is diluting determinism-first positioning.

### Required change
- Enforce narrative stack across docs and UI:
  1) Deterministic execution (core)
  2) Policy governance (control layer)
  3) Compliance outputs (consequence)

### Acceptance criteria
1. Top-level descriptions lead with deterministic execution and replay.
2. Governance/compliance language appears after core value explanation.
3. No top-level page claims compliance-first value without anchoring to deterministic run integrity.

### Success metric
- First-contact users can restate product value in one sentence matching deterministic core.

---

## Directive 3 — Reduce Front-Door Surface Area Without Removing Capability

### Problem addressed
- CLI/UI breadth appears intimidating before value is visible.

### Required change
- Keep capability, reduce visible choice load.
- Reorder menus/commands by adoption stage (first-run, operate, govern, extend).

### Acceptance criteria
1. First-run surfaces contain only essential actions.
2. Governance and advanced operations are discoverable but not primary in first-run contexts.
3. CLI help output includes a short “Start here” command path at top.

### Success metric
- Lower first-session command churn before first successful run.

---

## Directive 4 — Close Practitioner Adoption Gap

### Problem addressed
- Executive/security stakeholders are aligned while practitioners stall.

### Required change
- Add role-based quick paths for:
  - Platform Engineer
  - ML/AI Engineer
  - DevOps/SRE
  - OSS Maintainer

### Acceptance criteria
1. Each role has a concise first-week path with one tangible outcome.
2. Paths avoid unnecessary governance jargon in first steps.
3. Each path includes escalation to governance detail only after first success.

### Success metric
- Higher completion rates in first-week role-based onboarding tasks.

---

## Directive 5 — Repair Weak Parity Zones (Rollback, RBAC, Alerting Clarity)

### Problem addressed
- Competitive parity is weakest in rollback clarity, RBAC clarity, and alerting posture.

### Required change
- Clarify behavior and operator expectations before adding any new outward-facing features.

### Acceptance criteria
1. Rollback process is documented as a deterministic operator play with clear preconditions and outcomes.
2. RBAC model is explained in plain role language with common scenarios.
3. Alerting posture specifies default signals, destinations, and operator response intent.

### Success metric
- Fewer operator clarification requests in pilot readiness reviews.

---

## Directive 6 — Freeze Outward Breadth Until Compression Targets Pass

### Problem addressed
- Overcorrection trend continues through additive surface expansion.

### Required change
- Temporary freeze on net-new top-level routes/primary commands until onboarding and narrative targets are met.

### Acceptance criteria
1. New top-level surface additions require explicit exception rationale.
2. Compression metrics are reviewed prior to expanding outward-facing scope.

### Success metric
- Decrease in user-reported complexity and onboarding ambiguity.

---

## Priority Blockers Before Public Unveil
1. No single enforced first-value path.
2. Determinism anchor diluted by governance-heavy front-door narrative.
3. Operator confidence gaps in rollback/alerting/RBAC clarity.

## Single-Sentence Positioning Reality Check
Reach is a high-credibility deterministic execution platform whose adoption will stall unless first-run usability is compressed faster than outward-facing feature breadth expands.

## Non-Negotiable Rule for Next Iteration
Do not add new front-door capability until adoption friction drops measurably in first-run workflows.
