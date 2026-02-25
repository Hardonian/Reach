# VERIFY_SCCL

Run from repository root:

```bash
npx tsx scripts/sccl-cli.ts workspace validate
npx tsx scripts/sccl-cli.ts sync status
npx tsx scripts/sccl-cli.ts gate
npx tsx scripts/smoke-sccl.ts
npm run validate:sccl
vitest run src/sccl src/dgl/sccl-api.test.ts
```

Expected artifacts:

- `dgl/examples/sccl/status.json`
- `dgl/examples/sccl/conflict-report.json`
- `dgl/sccl/reports/*.conflicts.json`
- `dgl/sccl/run-records/*.json`
- `dgl/sccl/leases.json` (after lease commands)
