# Reach + ReadyLayer 30-Day Execution Checklist

Consolidated from:
- `docs/roadmap/90-day-plan.md`
- `docs/roadmap/high-priority-summary.md`

Status legend: `DONE` indicates implementation present and verification command defined in-repo.

| Item | Owner module(s) | Acceptance criteria | Verification steps | Status |
|---|---|---|---|---|
| Determinism replay fixture expansion and deterministic-order audits | `scripts/scan-determinism.ts`, `crates/engine-core/tests/*`, `src/determinism/*` | Replay/ordering checks are deterministic and exercised in tests. | `npm run verify:oss`; `npm run verify:rust` | DONE |
| DGL severity mapping + CI gate | `scripts/dgl-gate.ts`, `src/dgl/*`, `config/dgl-*.json` | Intent, semantic, language, and gate checks run in CI. | `npm run validate:language && npm run validate:intent && npm run validate:semantic && npm run validate:dgl` | DONE |
| DGL OpenAPI compatibility checks | `src/dgl/openapi-compat.ts`, `dgl/fixtures/openapi/*` | OpenAPI compatibility check reports warn/breaking changes deterministically. | `npm run reach:dgl:openapi` | DONE |
| DGL violations pagination/filtering and reporting | `apps/arcade/src/lib/dgl-runs-api.ts`, `src/dgl/routes-integration.test.ts`, `dgl/reports/*` | Violations and run views are server-side filtered/paginated and reportable. | `npm run test:routes`; `npm run reach:dgl:report` | DONE |
| DGL SARIF generation | `scripts/dgl-gate.ts`, `dgl/reports/dgl_report.sarif` | SARIF report emitted for CI/code scanning. | `npm run validate:dgl` | DONE |
| Supervisory telemetry + provider capability matrix | `dgl/telemetry/provider-metrics.jsonl`, `scripts/dgl-gate.ts` | Matrix output derived from telemetry and available through CLI report command. | `npm run reach:dgl:provider-matrix` | DONE |
| CPX patch pack validation and deterministic conflict artifacts | `scripts/cpx-cli.ts`, `src/dgl/cpx*.ts`, `dgl/cpx/examples/*` | Patch packs validate and emit deterministic merge/conflict packets + SARIF/JSON/MD artifacts. | `npm run reach:cpx:validate-pack && npm run smoke:cpx` | DONE |
| SCCL lease and coherence gate enforcement | `scripts/sccl-cli.ts`, `apps/arcade/src/lib/sccl-server.ts`, `dgl/sccl/*` | Lease state, stale-base detection, and gate checks enforce source-control coherence. | `npm run validate:sccl && npm run smoke:sccl` | DONE |
| Git host integration check/comment/label pipeline | `docs/integrations/git-host.md`, `apps/arcade/src/app/api/ci/ingest/route.ts`, `scripts/governance-audit.ts` | Git host ingestion and governance reporting path exists with auth and audit coverage. | `npm run audit:control-planes` | DONE |
| Artifact registry integrity and retention invariants | `apps/arcade/src/lib/db/*`, `docs/STORAGE_MODEL.md`, `docs/PACK_REGISTRY.md` | Content linkage and tenant-scoped storage behavior documented and enforced in storage layer APIs. | `npm run health:check`; `npm run verify:oss` | DONE |
| Policy engine enforcement across write paths + bypass/escalation | `config/governance-policy.json`, `scripts/dgl-gate.ts`, `apps/arcade/src/lib/cloud-auth.ts` | Policy checks and auth gates cover CLI/API entry points with structured errors + audit logs. | `npm run verify:oss`; `npm test` | DONE |
| Reconciliation loop webhook + scheduler coverage | `apps/arcade/src/app/api/ci/ingest/route.ts`, `apps/arcade/src/app/api/monitor/ingest/route.ts`, `docs/architecture/reconciliation-loop.md` | Deterministic ingest endpoints exist and are auth-gated with structured failures. | `npm run verify:routes` | DONE |
| Provider SDK contract and conformance tests | `src/providers/sdk/index.ts`, `src/providers/sdk/index.test.ts`, `sdk/python/*`, `sdk/ts/*` | Adapter contract and conformance tests exist with documented SDK entry points. | `npm test` | DONE |
| Onboarding flow from init to first governed PR | `docs/onboarding/flow.md`, `docs/product/first-success.md`, `docs/QUICKSTART_TECH.md` | Docs and commands provide end-to-end onboarding in OSS mode. | `npm run docs:check` | DONE |
| Security closure: auth gating + redaction + rate-limit-sensitive endpoints | `apps/arcade/src/lib/cloud-auth.ts`, `apps/arcade/src/lib/sanitize.ts`, `docs/security/threat-model.md` | Auth required on sensitive APIs and structured errors prevent token/header leakage. | `npm run verify:routes`; `npm run verify:oss` | DONE |
| Split-brain closure: stale base and missing run linkage checks | `scripts/sccl-cli.ts`, `dgl/sccl/fixtures/*`, `docs/architecture/source-control-coherence.md` | SCCL gate blocks stale-base/missing-link states and surfaces alerts. | `npm run validate:sccl` | DONE |
| Performance closure: changed-only checks, server-side pagination/filtering | `scripts/dgl-gate.ts`, `apps/arcade/src/lib/dgl-runs-api.ts` | Governance APIs and reporting avoid loading full data sets client-side by default. | `npm run test:routes`; `npm run validate:dgl` | DONE |
| Reliability closure: no hard-500 governance routes and structured API errors | `apps/arcade/src/app/governance/*`, `apps/arcade/src/app/api/v1/*`, `scripts/verify-routes.mjs` | Route smoke confirms key pages/APIs return non-500 responses and graceful errors. | `npm run verify:routes` | DONE |
| Vercel/Next readiness hard verification | `apps/arcade/vercel.json`, `docs/ops/vercel-deploy-verify.md`, `.github/workflows/verify.yml` | Next build + route smoke are documented and executed in CI. | `npm --prefix apps/arcade run build`; `npm run verify:routes` | DONE |

## Execution evidence updates

- Added Rust workspace verification script: `scripts/check-rust-workspace.sh`.
- Added Go workspace verification script: `scripts/check-go-workspace.sh`.
- Added canonical route smoke runner: `scripts/verify-routes.mjs`.
- Added SCCL governance route alias: `apps/arcade/src/app/governance/sccl/page.tsx`.
- Added Vercel verification runbook: `docs/ops/vercel-deploy-verify.md`.
- Added CI workflow route-smoke integration in `.github/workflows/verify.yml`.
