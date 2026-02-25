# UI Gap Map (Scope-Locked for Stitch)

## Target routes (score <= 2)

### `/console/agents`
- Add deterministic loading, empty, and error surfaces around registry datasets.
- Preserve existing registry panels and action affordances.
- Ensure light/dark token parity for table and filter controls.

### `/console/runners`
- Keep orchestration panel structure; add fallback states for queue/run collections.
- Clarify queue saturation and no-run scenarios with concise operator copy.
- Maintain existing routing and command affordances.

### `/console/traces`
- Add explicit states for trace-list loading, no traces, and fetch failure.
- Preserve timeline/detail interaction model and existing nav context.
- Avoid introducing new trace taxonomies or feature scope.

### `/console/evaluation`
- Add loading/empty/error boundaries around evaluation result collections.
- Keep current chart/table hierarchy; avoid adding new top-level panels.
- Use calm, operator-focused language with no marketing tone.

### `/console/datasets`
- Add standardized empty/error UX for dataset inventory and indexing status.
- Preserve existing dataset management primitives and hierarchy.
- Enforce dark/light parity for controls and state containers.

### `/console/integrations`
- Add deterministic empty/error handling for provider lists and connection status.
- Keep current card/list patterns and action layout.
- Do not introduce new providers, routes, or navigation branches.

## Excluded as strong (score = 3)
- `/console`
- `/console/ops`
- `/console/founder`
- `/console/governance/config-as-code`
# UI_GAP_MAP

| Route | Score (0-3) | Evidence | Missing panels/states | Recommendation | Priority |
|---|---:|---|---|---|---|
| `/architecture` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/architecture/page.tsx) | — | C | P2 |
| `/changelog` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/changelog/page.tsx) | — | C | P2 |
| `/cloud/login` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/cloud/login/page.tsx) | — | C | P2 |
| `/cloud` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/cloud/page.tsx) | — | C | P2 |
| `/cloud/register` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/cloud/register/page.tsx) | — | C | P2 |
| `/console/agents` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/agents/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console/alerts` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/alerts/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console/artifacts` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/artifacts/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console/billing` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/billing/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console/cost` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/cost/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console/datasets` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/datasets/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console/ecosystem` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/ecosystem/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console/evaluation` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/evaluation/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console/founder` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/founder/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console/governance/config-as-code` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/governance/config-as-code/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console/governance/dgl` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/console/governance/dgl/page.tsx) | — | C | P2 |
| `/console/governance` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/console/governance/page.tsx) | — | C | P2 |
| `/console/integrations` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/integrations/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console/nav` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/console/nav/page.tsx) | — | C | P2 |
| `/console/ops` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/ops/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/console/page.tsx) | — | C | P2 |
| `/console/runners` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/runners/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console/safety` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/safety/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/console/traces` | 2 | Renders stitched static datasets without explicit loading/empty/error state handling. (apps/arcade/src/app/console/traces/page.tsx) | Loading skeleton, empty state, degraded/error banner, real data-state slots. | A | P1 |
| `/contact` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/contact/page.tsx) | — | C | P2 |
| `/dashboard` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/dashboard/page.tsx) | — | C | P2 |
| `/decisions/{id}` | 2 | Route includes mock/demo-centric data path and basic state handling only. (apps/arcade/src/app/decisions/[id]/page.tsx) | Robust empty/error variants + stronger hierarchy for run evidence panels. | A | P1 |
| `/decisions/new` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/decisions/new/page.tsx) | — | C | P2 |
| `/decisions` | 2 | Route includes mock/demo-centric data path and basic state handling only. (apps/arcade/src/app/decisions/page.tsx) | Robust empty/error variants + stronger hierarchy for run evidence panels. | A | P1 |
| `/demo/actions` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/demo/actions/page.tsx) | — | C | P2 |
| `/demo/decisions` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/demo/decisions/page.tsx) | — | C | P2 |
| `/demo/events` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/demo/events/page.tsx) | — | C | P2 |
| `/demo/evidence-viewer` | 1 | Explicit enterprise stub copy and OSS-only fallback messaging in header. (apps/arcade/src/app/demo/evidence-viewer/page.tsx) | Tenant RBAC/audit stream panel parity, clear OSS vs Enterprise split cards. | A | P1 |
| `/demo/evidence` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/demo/evidence/page.tsx) | — | C | P2 |
| `/demo/exports` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/demo/exports/page.tsx) | — | C | P2 |
| `/demo/junctions` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/demo/junctions/page.tsx) | — | C | P2 |
| `/demo` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/demo/page.tsx) | — | C | P2 |
| `/demo/vitals` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/demo/vitals/page.tsx) | — | C | P2 |
| `/docs/agents` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/agents/page.tsx) | — | C | P2 |
| `/docs/api` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/api/page.tsx) | — | C | P2 |
| `/docs/architecture` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/architecture/page.tsx) | — | C | P2 |
| `/docs/auth` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/auth/page.tsx) | — | C | P2 |
| `/docs/cli` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/cli/page.tsx) | — | C | P2 |
| `/docs/configuration` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/configuration/page.tsx) | — | C | P2 |
| `/docs/dashboard` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/dashboard/page.tsx) | — | C | P2 |
| `/docs/deployment` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/deployment/page.tsx) | — | C | P2 |
| `/docs/endpoints` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/endpoints/page.tsx) | — | C | P2 |
| `/docs/engine` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/engine/page.tsx) | — | C | P2 |
| `/docs/errors` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/errors/page.tsx) | — | C | P2 |
| `/docs/execution` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/execution/page.tsx) | — | C | P2 |
| `/docs/getting-started` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/getting-started/page.tsx) | — | C | P2 |
| `/docs/governance` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/governance/page.tsx) | — | C | P2 |
| `/docs/installation` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/installation/page.tsx) | — | C | P2 |
| `/docs/integrations` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/integrations/page.tsx) | — | C | P2 |
| `/docs/marketplace` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/marketplace/page.tsx) | — | C | P2 |
| `/docs/mcp` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/mcp/page.tsx) | — | C | P2 |
| `/docs/observability` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/observability/page.tsx) | — | C | P2 |
| `/docs/orchestration` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/orchestration/page.tsx) | — | C | P2 |
| `/docs` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/page.tsx) | — | C | P2 |
| `/docs/pipelines` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/pipelines/page.tsx) | — | C | P2 |
| `/docs/providers` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/providers/page.tsx) | — | C | P2 |
| `/docs/quick-start` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/quick-start/page.tsx) | — | C | P2 |
| `/docs/security` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/security/page.tsx) | — | C | P2 |
| `/docs/skills` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/skills/page.tsx) | — | C | P2 |
| `/docs/studio` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/studio/page.tsx) | — | C | P2 |
| `/docs/tools` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/tools/page.tsx) | — | C | P2 |
| `/docs/webhooks` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/docs/webhooks/page.tsx) | — | C | P2 |
| `/download` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/download/page.tsx) | — | C | P2 |
| `/enterprise` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/enterprise/page.tsx) | — | C | P2 |
| `/faq` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/faq/page.tsx) | — | C | P2 |
| `/gallery` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/gallery/page.tsx) | — | C | P2 |
| `/governance/artifacts` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/governance/artifacts/page.tsx) | — | C | P2 |
| `/governance/cpx` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/governance/cpx/page.tsx) | — | C | P2 |
| `/governance/determinism` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/governance/determinism/page.tsx) | — | C | P2 |
| `/governance/dgl` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/governance/dgl/page.tsx) | — | C | P2 |
| `/governance/economics` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/governance/economics/page.tsx) | — | C | P2 |
| `/governance` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/governance/page.tsx) | — | C | P2 |
| `/governance/policy` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/governance/policy/page.tsx) | — | C | P2 |
| `/governance/providers` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/governance/providers/page.tsx) | — | C | P2 |
| `/governance/sccl` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/governance/sccl/page.tsx) | — | C | P2 |
| `/governance/source-control` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/governance/source-control/page.tsx) | — | C | P2 |
| `/legal/cookies` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/legal/cookies/page.tsx) | — | C | P2 |
| `/legal` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/legal/page.tsx) | — | C | P2 |
| `/legal/privacy` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/legal/privacy/page.tsx) | — | C | P2 |
| `/legal/terms` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/legal/terms/page.tsx) | — | C | P2 |
| `/library` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/library/page.tsx) | — | C | P2 |
| `/marketplace-alt` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/marketplace-alt/page.tsx) | — | C | P2 |
| `/marketplace` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/marketplace/page.tsx) | — | C | P2 |
| `/monitoring` | 2 | Single-surface page without secondary diagnostic panels or skeleton states. (apps/arcade/src/app/monitoring/page.tsx) | Loading/empty/error states and split panel hierarchy for history + actions. | A | P1 |
| `/` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/page.tsx) | — | C | P2 |
| `/playground` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/playground/page.tsx) | — | C | P2 |
| `/pricing` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/pricing/page.tsx) | — | C | P2 |
| `/reports/{id}` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/reports/[id]/page.tsx) | — | C | P2 |
| `/reports/share/{slug}` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/reports/share/[slug]/page.tsx) | — | C | P2 |
| `/responsible-disclosure` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/responsible-disclosure/page.tsx) | — | C | P2 |
| `/roadmap` | 2 | Minimal static card/list structure without page shell states. (apps/arcade/src/app/roadmap/page.tsx) | Structured sections, chronology/status badges, loading/empty/error shell. | A | P1 |
| `/security` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/security/page.tsx) | — | C | P2 |
| `/settings/advanced/security` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/settings/advanced/security/page.tsx) | — | C | P2 |
| `/settings/advanced/webhooks` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/settings/advanced/webhooks/page.tsx) | — | C | P2 |
| `/settings/alerts` | 2 | Form-first UI with basic success/failure banners but limited progressive states. (apps/arcade/src/app/settings/alerts/page.tsx) | Per-section empty/loading states, save-progress and validation severity badges. | A | P1 |
| `/settings/api-keys` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/settings/api-keys/page.tsx) | — | C | P2 |
| `/settings/billing` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/settings/billing/page.tsx) | — | C | P2 |
| `/settings` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/settings/page.tsx) | — | C | P2 |
| `/settings/profile` | 2 | Form-first UI with basic success/failure banners but limited progressive states. (apps/arcade/src/app/settings/profile/page.tsx) | Per-section empty/loading states, save-progress and validation severity badges. | A | P1 |
| `/settings/release-gates` | 2 | Form-first UI with basic success/failure banners but limited progressive states. (apps/arcade/src/app/settings/release-gates/page.tsx) | Per-section empty/loading states, save-progress and validation severity badges. | A | P1 |
| `/share` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/share/page.tsx) | — | C | P2 |
| `/simulate` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/simulate/page.tsx) | — | C | P2 |
| `/skills` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/skills/page.tsx) | — | C | P2 |
| `/studio` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/studio/page.tsx) | — | C | P2 |
| `/support/contact` | 2 | Single-surface page without secondary diagnostic panels or skeleton states. (apps/arcade/src/app/support/contact/page.tsx) | Loading/empty/error states and split panel hierarchy for history + actions. | A | P1 |
| `/support` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/support/page.tsx) | — | C | P2 |
| `/support/status` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/support/status/page.tsx) | — | C | P2 |
| `/templates` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/templates/page.tsx) | — | C | P2 |
| `/tools` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/tools/page.tsx) | — | C | P2 |
| `/transparency` | 3 | Dedicated page/component with complete content. (apps/arcade/src/app/transparency/page.tsx) | — | C | P2 |
| `/whitepaper` | 2 | Minimal static card/list structure without page shell states. (apps/arcade/src/app/whitepaper/page.tsx) | Structured sections, chronology/status badges, loading/empty/error shell. | A | P1 |
