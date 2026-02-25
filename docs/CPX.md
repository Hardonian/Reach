# Counterfactual Patch Simulation (CPX)

CPX evaluates multiple candidate patch packs against deterministic governance signals, then emits an arbitration decision:

- `SELECT_ONE`
- `REQUEST_REWORK`
- `PROPOSE_MERGE_PLAN`
- `SELECT_ONE_WITH_PATCHUPS`

## Patch Pack

Patch packs are validated against `dgl/cpx/patch-pack.schema.json` and include diff content, metadata, and optional DGL/OpenAPI/route artifacts.

## Commands

- `npx tsx scripts/cpx-cli.ts pack --from <git-ref> --to <git-ref> --out <path>`
- `npx tsx scripts/cpx-cli.ts validate-pack <path>`
- `npx tsx scripts/cpx-cli.ts run --packs <pack-a.json,pack-b.json>`
- `npx tsx scripts/cpx-cli.ts report --id <run-id>`

## Outputs

- JSON report: `dgl/cpx/reports/<run_id>.json`
- Markdown summary: `dgl/cpx/reports/<run_id>.md`
- SARIF: `dgl/cpx/reports/<run_id>.sarif`

## ReadyLayer integration

Use `dgl/examples/workflows/cpx.yml` as the CI gate template. The gate should fail when decision is `REQUEST_REWORK`, and pass for `SELECT_ONE` or `PROPOSE_MERGE_PLAN` with no blocking errors.

## UI

- Dashboard: `/governance/cpx`
- APIs: `/api/cpx/runs`, `/api/cpx/runs/:id`, `/api/cpx/runs/:id/candidates`, `/api/cpx/runs/:id/conflicts`
