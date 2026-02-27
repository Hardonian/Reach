# Verify DGL

## Commands

1. `npx tsx scripts/verify-dgl.ts`
2. `npx tsx scripts/smoke-dgl.ts`
3. `npm run test`
4. `npm run test:routes`

## Expected outputs

- `dgl/reports/dgl_report.json` exists with `timings_ms` and `openapi_compat_summary`.
- `dgl/reports/openapi_compat.json` exists and reports breaking or warning counts.
- `.cache/dgl/*.json` entries are created and reused.
- `dgl/run-records/<run_id>.json` exists after scan.

## Artifact paths

- `dgl/reports/dgl_report.json`
- `dgl/reports/dgl_report.sarif`
- `dgl/reports/dgl_report.md`
- `dgl/reports/openapi_compat.json`
- `dgl/run-records/*.json`
- `dgl/examples/generated/smoke-output.json`
