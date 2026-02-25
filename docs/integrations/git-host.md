# Git Host Integration (GitHub App first, GitLab-ready)

## Objective

Provide a least-privilege integration layer that keeps governance signals (DGL, CPX, SCCL) attached to source control events without introducing long-lived "god" tokens.

## Current Reach Integration Surface

- **Webhook ingress** exists for GitHub event intake (`apps/arcade/src/app/api/github/webhook/route.ts`).
- **Governance emitters** exist for DGL and CPX report generation (`scripts/dgl-gate.ts`, `scripts/cpx-cli.ts`).
- **SCCL gate + lease model** is available for branch mutation coordination (`src/sccl/*`).
- **Policy contract** is centralized in `config/governance-policy.json` and should be consulted before any write action.

## Required Capabilities

1. **PR lifecycle orchestration**
   - Create/update pull requests from governed branch outputs.
   - Upsert PR comments with DGL, CPX, and SCCL summaries.
2. **Status/check runs**
   - Publish machine-readable checks per gate (`validate:language`, DGL gate, SCCL gate).
   - Ensure check names are stable for branch protection rules.
3. **SARIF publishing**
   - Upload CPX and semantic-drift findings as SARIF when available.
4. **Acknowledge/approval routing**
   - Apply policy-driven labels (`governance/ack-required`, `governance/approved`, `risk/high`).
   - Auto-assign reviewers based on touched high-risk zones.

## Auth Model (Required)

- Prefer **GitHub App installation tokens** (short-lived, repository-scoped).
- Support **OIDC exchange** for CI-to-host calls where available.
- Reject PAT-based broad scopes in production automation paths.
- Never persist host tokens in artifact payloads, run exports, or logs.

## Security Guardrails

- Verify webhook signatures before processing event payloads.
- Redact bearer tokens, secrets, and webhook signatures in all logs.
- Include `tenant_id`, `workspace_id`, `actor`, and `run_id` in mutation audit trails.
- Fail closed on signature/auth mismatch with structured, non-500 responses.

## Operational Sequence

1. Receive webhook (PR sync/push).
2. Enqueue deterministic reconciliation task.
3. Recompute DGL/CPX/SCCL outcomes.
4. Evaluate governance policy (`config/governance-policy.json`).
5. Post/update check runs and PR summary.
6. Apply labels/reviewer assignment from policy output.
7. Write immutable audit event with links to run/artifact hashes.

## Rollout Plan

- **Phase 1:** webhook + comments + checks (read-mostly with safe write paths).
- **Phase 2:** policy-aware labels/reviewer automation.
- **Phase 3:** SARIF upload + GitLab API parity adapter.

