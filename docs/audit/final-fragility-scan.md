# Final Fragility Scan (High-Leverage Closure)

Date: 2026-02-25
Owner: Final pre-Gemini/Kimi closure pass
Scope: add-if-missing / improve-if-existing only

## Executive Summary

This scan focused on the remaining high-leverage reliability/trust gaps that could still produce false-green releases, onboarding friction, or operator confusion.

## P0 (Ship Blockers)

1. Health/readiness endpoints missing for deployment diagnostics.

- Risk: blind deploys and weak platform readiness signals.
- Fix: added `/api/health` and `/api/ready` with degraded-mode behavior when cloud DB is disabled.

2. Route smoke checks were too permissive (`<500` allowed false greens such as 404).

- Risk: missing critical routes could still pass CI.
- Fix: rewrote `verify:routes` with explicit expected status sets and expanded coverage for governance, artifact, DGL/CPX/SCCL/policy surfaces.

3. `verify:spec` CLI path was fragile and could be effectively no-op.

- Risk: schema validation drift could ship undetected.
- Fix: fixed `tools/validate-spec.mjs` CLI behavior and added concrete fixtures under `spec/fixtures`.

## P1 (High Priority)

1. Governance UI contained TODO theater and inconsistent affordances.

- Risk: low operator trust and ambiguous actions.
- Fix: replaced TODO handlers with explicit guarded actions and added consistent copy-command UX.

2. Missing golden-path command experience for OSS adoption.

- Risk: onboarding drop after install.
- Fix: added `reach quickstart` + deterministic fixture artifact generation and documented 10-minute CLI/web/mixed flows.

3. Release engineering lacked deterministic dry-run checks and changelog-derived note enforcement.

- Risk: release-time surprises and inconsistent metadata.
- Fix: added `verify:release`, changelog release-note renderer, and hardened release workflow controls.

## P2 (Operational Hardening)

1. Governance metrics/reconciliation visibility were sparse.

- Risk: slower debugging and weaker production status visibility.
- Fix: added lightweight observability counters, persisted snapshots, and `reach status`.

2. Public ingress routes lacked consistent rate limiting.

- Risk: abuse/noise amplification on webhook/ingest paths.
- Fix: added rate limiting on CI ingest, GitHub webhook, monitor ingest, and manual gate trigger.

3. Multiple catch blocks swallowed errors with no context.

- Risk: hidden failures and slow incident response.
- Fix: converted key swallow paths to structured warnings with tenant/action context.

## Residual Non-Blocking Items

1. Some script-level `console.log` output remains in CLI/dev tooling by design.
2. Workspace is intentionally dirty from parallel streams; this pass avoided unrelated reverts.

## Determinism / Replay Safety

No determinism core algorithm, replay hashing contract, or replay semantics were changed.

This pass is limited to docs, verification harnesses, release/ops hardening, ingress safety, observability, and UX reliability polish.
