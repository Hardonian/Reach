# Traceability Contract

## Trace ID Propagation

Every execution in Reach is assigned a **Trace ID** — a unique identifier that links the request through all stages of processing.

### Trace ID Format

- Type: `TraceId` (branded string, see `lib/trace/traceUrl.ts`)
- Length: 4–128 characters
- Example: `Trace-8f92`, `tr_0x882a91`, `req_m1abc_xyz`

### Canonical URL Shape

All trace deep-links use a single canonical format:

```
/console/traces?trace=<id>
```

Use `traceUrl(id)` from `@/lib/trace/traceUrl` to generate this — never construct the URL manually.

### Standard Components

| Component       | Location                                             | Purpose                                                    |
| --------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| `TraceLink`     | `components/trace/TraceLink.tsx`                     | Inline link to a trace. Renders disabled span when absent. |
| `TracePill`     | `components/trace/TracePill.tsx`                     | Compact pill for tables/cards. Truncates long IDs.         |
| `TraceTimeline` | `components/stitch/console/panels/TraceTimeline.tsx` | Full timeline visualization of trace steps.                |
| `TraceExplorer` | `components/stitch/console/pages/TraceExplorer.tsx`  | Full-page trace exploration with search and details panel. |

### Rules

1. **All tables displaying trace IDs** must use `TraceLink` or `TracePill` — never raw `<a>` tags.
2. **Absent trace IDs** must render a disabled state (no crashes, no broken links).
3. **Correlation IDs** from the auth layer (`req_*` format) are valid trace IDs.
4. **Trace search** is available on `/console/traces` via the search input.

### Entities That Carry Trace IDs

- Agent runs (`AgentRun.traceId`)
- Workflow executions (`workflow_runs.id`)
- Evaluation results
- Artifact provenance
- Alert context
