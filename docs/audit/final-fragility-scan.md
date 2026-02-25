# Final Fragility Scan (High-Leverage Closure)

Date: 2026-02-25
Owner: Final pre-Gemini/Kimi closure pass
Scope: add-if-missing / improve-if-existing only

## Executive Summary

This scan identified final fragility/theatre risks that reduce adoption trust, release confidence, and operational resilience. Fixes are prioritized by blast radius and implementation leverage.

## P0 (Ship Blockers)

1. Missing public health/readiness endpoints for deployment platforms.
- Risk: blind deploys, poor Vercel/CI diagnostics.
- Fix: add `/api/health` and `/api/ready` with cloud DB readiness checks and safe degraded behavior.
- Status: fixed in this pass.

2. Route smoke coverage incomplete for governance/artifact/CPX/SCCL/DGL/policy surfaces.
- Risk: false-green deploys and hard-500 regressions.
- Fix: expand `verify:routes` + smoke harness route matrix.
- Status: fixed in this pass.

3. Release verification missing deterministic dry-run gate.
- Risk: release breaks detected after tagging.
- Fix: add `verify:release` script validating changelog/version/workflow/release artifacts assumptions.
- Status: fixed in this pass.

## P1 (High Priority)

1. Governance UI TODO theatre in policy actions.
- Risk: broken user trust and unclear operator behavior.
- Fix: replace TODO placeholders with explicit non-destructive action handlers and UX messaging.
- Status: fixed in this pass.

2. No single “10-minute success” canonical path across CLI/Web/mixed.
- Risk: onboarding friction and adoption drop.
- Fix: add `docs/getting-started/10-minute-success.md` + `reach quickstart` path.
- Status: fixed in this pass.

3. Conformance entrypoint not unified.
- Risk: ecosystem adapter quality drift.
- Fix: add `verify:conformance` runner bundling schema, compat, fixture, and contract checks.
- Status: fixed in this pass.

4. Security posture docs fragmented.
- Risk: slower enterprise evaluation and incident response ambiguity.
- Fix: add `security-posture`, `incident-response`, `permissions-matrix` docs.
- Status: fixed in this pass.

## P2 (Operational Hardening)

1. Sparse operational release playbook.
- Risk: tribal release knowledge.
- Fix: add `docs/ops/releasing.md` mapped to scripts/workflows.
- Status: fixed in this pass.

2. Observability counters not normalized for governance-critical actions.
- Risk: limited trend visibility and slow debugging.
- Fix: add lightweight observability counters and status reporting hooks.
- Status: fixed in this pass.

3. Idempotency seam for GitHub check updates can duplicate updates on retries.
- Risk: noisy checks, non-deterministic PR status updates.
- Fix: add idempotent check-run reuse/update flow.
- Status: fixed in this pass.

## Additional Findings (Tracked, Non-Blocking)

1. Some informational `console.log` usage remains in dev/test scripts.
- These are mostly CLI/reporting outputs, not secret-bearing service logs.

2. Existing broad dirty worktree indicates concurrent workstreams.
- Mitigation: this closure pass modified only targeted files and did not revert unrelated changes.

## Determinism / Replay Safety

No determinism core algorithm or replay hashing semantics were changed in this pass. Changes are in docs, verification harnesses, health endpoints, observability plumbing, and UX hardening.
