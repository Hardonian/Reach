# POST_STITCH_INTEGRATION

## Expected touch paths
- `apps/arcade/src/app/demo/evidence-viewer/page.tsx`
- `apps/arcade/src/app/decisions/[id]/page.tsx`
- `apps/arcade/src/app/console/governance/config-as-code/page.tsx`
- `apps/arcade/src/app/settings/release-gates/page.tsx`
- `apps/arcade/src/app/console/alerts/page.tsx`
- `apps/arcade/src/app/console/traces/page.tsx`
- `apps/arcade/src/app/monitoring/page.tsx`
- `apps/arcade/src/app/support/contact/page.tsx`
- `apps/arcade/src/app/roadmap/page.tsx`
- `apps/arcade/src/app/whitepaper/page.tsx`
- Optional shared primitives if needed:
  - `apps/arcade/src/components/EmptyState.tsx`
  - `apps/arcade/src/components/DegradedBanner.tsx`
  - `apps/arcade/src/components/stitch/shared/DegradedBanner.tsx`
  - `apps/arcade/src/components/stitch/console/ConsoleLayout.tsx`

## Import/export patterns to preserve
- Keep App Router default exports in each `page.tsx` route file.
- Preserve client/server boundaries (`'use client'` only where browser hooks are used).
- Keep alias imports using `@/` (configured in `apps/arcade/tsconfig.json`).
- Do not move enterprise-only logic into OSS-core shared modules.
- Preserve route params signature in dynamic routes (`[id]`, `[slug]`).

## Required verification commands
- `pnpm -r build`
- `npm run validate:language`
- `npm run validate:boundaries`
- `npm run validate:oss-purity`

## Smoke routes (no hard-500)
- `/demo/evidence-viewer`
- `/decisions/seed-1` (or existing ID)
- `/console/governance/config-as-code`
- `/settings/release-gates`
- `/console/alerts`
- `/console/traces`
- `/monitoring`
- `/support/contact`
- `/roadmap`
- `/whitepaper`
