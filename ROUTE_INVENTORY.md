# Route Inventory (Post-Audit Stitch Packaging)

## Console routes reviewed

| Route | App Route File | Primary UI File | Score | Notes |
|---|---|---|---:|---|
| `/console` | `apps/arcade/src/app/console/page.tsx` | `apps/arcade/src/components/stitch/console/pages/MissionControlOverview.tsx` | 3 | Rich overview with composed panels; considered strong baseline. |
| `/console/ops` | `apps/arcade/src/app/console/ops/page.tsx` | same file | 3 | Stateful controls + audited actions already implemented. |
| `/console/founder` | `apps/arcade/src/app/console/founder/page.tsx` | same file | 3 | Full founder dashboard implementation. |
| `/console/governance/config-as-code` | `apps/arcade/src/app/console/governance/config-as-code/page.tsx` | same file | 3 | Detailed governance workflow already present. |
| `/console/agents` | `apps/arcade/src/app/console/agents/page.tsx` | `apps/arcade/src/components/stitch/console/pages/AgentRegistry.tsx` | 2 | Strong visual shell, missing explicit loading/empty/error UX treatment. |
| `/console/runners` | `apps/arcade/src/app/console/runners/page.tsx` | `apps/arcade/src/components/stitch/console/pages/RunnerOrchestration.tsx` | 2 | Dashboard present, but resilience states not explicit. |
| `/console/traces` | `apps/arcade/src/app/console/traces/page.tsx` | `apps/arcade/src/components/stitch/console/pages/TraceExplorer.tsx` | 2 | Explorer UI exists; requires deterministic state handling polish. |
| `/console/evaluation` | `apps/arcade/src/app/console/evaluation/page.tsx` | `apps/arcade/src/components/stitch/console/pages/EvaluationEngine.tsx` | 2 | Good baseline, lacks complete fallback-state choreography. |
| `/console/datasets` | `apps/arcade/src/app/console/datasets/page.tsx` | `apps/arcade/src/components/stitch/console/pages/DatasetManagement.tsx` | 2 | Functional shell with no explicit empty/error view guarantees. |
| `/console/integrations` | `apps/arcade/src/app/console/integrations/page.tsx` | `apps/arcade/src/components/stitch/console/pages/IntegrationsHub.tsx` | 2 | Integration cards present; standardized states need tightening. |
