# Verify CPX

## Commands

1. `npx tsx scripts/cpx-cli.ts validate-pack dgl/cpx/fixtures/s1-pack-a.json`
2. `npx tsx scripts/cpx-cli.ts run --packs dgl/cpx/fixtures/s1-pack-a.json,dgl/cpx/fixtures/s1-pack-b.json`
3. `npx tsx scripts/smoke-cpx.ts`
4. `npm test -- src/dgl/cpx.test.ts`

## Expected artifacts

- `dgl/cpx/reports/cpx-*.json`
- `dgl/cpx/reports/cpx-*.md`
- `dgl/cpx/reports/cpx-*.sarif`
- `dgl/cpx/examples/*.json`
- `dgl/cpx/examples/*.md`
- `dgl/cpx/examples/*.sarif`
