# COMPONENT_GAPS

| Component / Primitive | Current status | Missing variant/state | Where needed |
|---|---|---|---|
| `ConsoleLayout` (`apps/arcade/src/components/stitch/console/ConsoleLayout.tsx`) | Exists, provides shell and nav | Domain-level loading skeleton slot and route-level error slot | All `/console/*` routes |
| `EmptyState` (`apps/arcade/src/components/EmptyState.tsx`) | Exists globally | Console-themed variant (dark, icon + CTA) and docs/marketing neutral variant | `/console/*`, `/monitoring`, `/settings/*` |
| Error/degraded banner (`apps/arcade/src/components/DegradedBanner.tsx`, `.../stitch/shared/DegradedBanner.tsx`) | Exists | Unified `ErrorState` panel for full-page recoverable failures | `/decisions/{id}`, `/monitoring`, `/support/contact` |
| Page shell primitive | Missing as reusable component | Standard `PageShell` with title, subtitle, actions, breadcrumbs | `/roadmap`, `/whitepaper`, `/demo/evidence-viewer` |
| Loading skeleton primitive | Missing reusable primitive | `LoadingSkeleton` rows/cards for tables and analytics panels | `/console/*`, `/governance/*`, `/settings/*` |
| Status badges | Partial (ad-hoc classes in stitch pages) | Shared semantic variants (`success`, `warning`, `critical`, `info`) | `/console/alerts`, `/console/safety`, `/monitoring` |
| Data table patterns | Exists in per-page implementation (`AgentTable`, `TraceTimeline`) | Consistent empty/loading/error wrappers + pagination header/footer | `/console/agents`, `/console/traces`, `/console/artifacts` |
| Theme parity utilities | Dark theme dominant in stitch pages | Explicit light/dark parity checks + tokenized color map | All stitch console pages |
