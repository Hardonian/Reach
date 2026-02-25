# Post-Stitch Integration Checklist

## 1) Expected file touch set (strict)

Stitch output must be limited to the scoped route wrappers and their mapped page components in `STITCH_SCOPE.json`, plus optional shared primitives only if missing:

### Scoped route wrappers
- `apps/arcade/src/app/console/agents/page.tsx`
- `apps/arcade/src/app/console/runners/page.tsx`
- `apps/arcade/src/app/console/traces/page.tsx`
- `apps/arcade/src/app/console/evaluation/page.tsx`
- `apps/arcade/src/app/console/datasets/page.tsx`
- `apps/arcade/src/app/console/integrations/page.tsx`

### Scoped page implementations
- `apps/arcade/src/components/stitch/console/pages/AgentRegistry.tsx`
- `apps/arcade/src/components/stitch/console/pages/RunnerOrchestration.tsx`
- `apps/arcade/src/components/stitch/console/pages/TraceExplorer.tsx`
- `apps/arcade/src/components/stitch/console/pages/EvaluationEngine.tsx`
- `apps/arcade/src/components/stitch/console/pages/DatasetManagement.tsx`
- `apps/arcade/src/components/stitch/console/pages/IntegrationsHub.tsx`

### Optional shared primitive additions (only if genuinely missing)
- `apps/arcade/src/components/stitch/console/panels/*`
- `apps/arcade/src/components/EmptyState.tsx` (extend only)

## 2) Integration rules

- Keep import style consistent with repo conventions:
  - Use alias imports (`@/components/...`, `@/lib/...`) for app-local modules.
  - Avoid deep relative traversals when an alias exists.
- Reuse existing layout/frame:
  - Keep `ConsoleLayout` as the page shell for all scoped routes.
  - Reuse existing table/panel patterns in `components/stitch/console/panels`.
- Shared primitives placement:
  - Route-specific blocks stay in each page file under `components/stitch/console/pages`.
  - Cross-route primitives belong under `components/stitch/console/panels`.
- Navigation wiring:
  - Do not rename routes or move navigation groups.
  - Only add links for already-existing scoped routes if a scoped route is missing from existing nav.
- Reliability contract:
  - Every touched page must include explicit loading, empty, and error states.
  - No hard-500 user route behavior; return a graceful fallback state.
- OSS/Enterprise boundary:
  - Do not import cloud-only services into OSS app paths.

## 3) Verification commands

Run from repository root unless noted:

```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm run validate:language
npm run validate:boundaries
npm run validate:oss-purity
npm run verify:oss
```

## 4) Smoke route list

When app server is running, verify:

- `GET /` (marketing, 200)
- `GET /pricing` (additional marketing page, 200)
- `GET /app` (must not 500)
- `GET /console/agents` (must not 500; redirect/gate acceptable)
- `GET /console/runners` (must not 500; redirect/gate acceptable)
- `GET /console/traces` (must not 500; redirect/gate acceptable)
- `GET /console/evaluation` (must not 500; redirect/gate acceptable)
- `GET /console/datasets` (must not 500; redirect/gate acceptable)
- `GET /console/integrations` (must not 500; redirect/gate acceptable)
