# Reach — Bias Closure Scorecard (Strict)

Use this with `prompts/ANTIGRAVITY_KIMI_BIAS_CLOSURE_PROMPT.md`.

## Purpose
Provide a deterministic, anti-theater grade for whether a Kimi run actually closed the bias-driven gaps.

## Inputs Required
- Run output report from Kimi
- Repo diff
- Verification command outputs
- Smoke route status codes
- Evidence file paths per closure item

## Scoring Model
- Total: 100 points
- Hard-gate failures override score and force `RED`

### Section A — P0 Credibility Closures (60 points)
- `route_nav_integrity` (10)
- `api_key_lifecycle_ui` (10)
- `audit_workflow_ui` (10)
- `what_failed_explainer` (10)
- `policy_gate_rollback` (10)
- `ownership_metadata` (10)

### Section B — Enterprise Trust Parity (20 points)
- `identity_claims_parity` (8)
  - `Shipped` or `Claim Downgraded` both count as complete.
- `enterprise_analytics_ui` (4)
- `compliance_export_bundle` (8)

### Section C — Operator UX Closures (20 points)
- `trace_explorer_live` (5)
- `integration_setup_wizard` (4)
- `alert_delivery_ledger` (4)
- `onboarding_server_persistence` (3)
- `executive_reporting` (4)

## Status-to-Score Mapping
- `Shipped` = 1.0
- `Partially Shipped` = 0.5
- `Blocked` = 0
- `Claim Downgraded` = 1.0 only for `identity_claims_parity`, otherwise 0

## Hard Gates (Any fail => RED)
1. Determinism/replay semantics unchanged (`determinism_semantics_unchanged=true`).
2. Required verification commands all pass:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
   - `npm run verify:routes`
   - `npm run verify:oss`
   - `npm run verify:boundaries`
3. All smoke routes in report are non-500.
4. All P0 items are `Shipped`.

## Grade Bands
- `GREEN`: hard gates pass and score >= 85
- `YELLOW`: hard gates pass and score 70-84
- `RED`: hard gate fail or score < 70

## How To Run
1. Fill JSON template:
   - `prompts/ANTIGRAVITY_KIMI_BIAS_CLOSURE_SCORECARD.template.json`
2. Run grader:
   - `node tools/grade-bias-closure.mjs prompts/ANTIGRAVITY_KIMI_BIAS_CLOSURE_SCORECARD.template.json`

## Required Evidence Standard
For each closure item include:
- `status`
- at least 1 concrete evidence path
- at least 1 verification step or command
- short impact note

If evidence is missing, grader treats item as `Blocked`.
