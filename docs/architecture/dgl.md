# Divergence Governance Layer (DGL)

DGL extends deterministic replay with semantic governance. Replay proves mechanical integrity; DGL proves alignment integrity.

## Data flow

1. `reach dgl scan` compares `--base` and `--head` revisions.
2. Scan modules compute:
   - terminology drift
   - intent fingerprint drift
   - semantic drift (API/trust-boundary/dependency deltas)
3. Reporter writes:
   - `dgl_report.json`
   - `dgl_report.sarif`
   - `dgl_report.md`
4. `reach dgl gate` enforces severity policy and exits non-zero on `error` violations.
5. `reach dgl provider-matrix` updates telemetry and calibration outputs.
6. `reach dgl route` recommends provider/model by Bayesian-like risk estimate.

## Invariants

- User-facing paths must not expose internal graph/protocol language.
- Intent manifest changes require explicit acknowledgement under `dgl/intent-acknowledgements/`.
- Trust-boundary file changes are elevated to `error` until acknowledged.
- Reports are schema-versioned for stable tooling integration.

## File layout

- `src/dgl/*`: scan/report/routing modules
- `scripts/dgl-gate.ts`: CI/CLI entrypoint
- `config/canonical-language.json`: terminology policy
- `docs/architecture/intent-manifest.json`: intent baseline source
- `dgl/baselines/intent/*.json`: intent fingerprints
- `dgl/examples/*`: checked-in example outputs

## Integration points

- CLI: `src/cli/reach-cli.ts` (`reach dgl *`)
- CI: `.github/workflows/verify.yml` and package scripts (`validate:intent`, `validate:semantic`, `validate:dgl`)
- ReadyLayer: `npm run readylayer:gates:dgl` preset command


## API

- `GET /api/governance/dgl` (auth required) returns live report, provider matrix, violations, and turbulence hotspots with filter params `branch`, `provider`, `subsystem`.


## OpenAPI compatibility

Use `reach dgl openapi` to compare base/head OpenAPI contracts (YAML or JSON) and emit compatibility violations. Breaking changes (removed endpoints, new required params, schema breaks, removed content/status) are `error`; additive changes are `warn`.

Configuration lives in `config/dgl-openapi.json`:
- `allowlisted_endpoints`
- `allowlisted_status_shifts`
- `path_prefixes`

Intentional breaks must include an acknowledgement file in `dgl/intent-acknowledgements/`.

## Changed-only scans and cache

`reach dgl scan` defaults to changed-only via `git diff`; pass `--full` for full-repo scan fallback behavior.

DGL scan results are cached under `.cache/dgl/` using key material:
- diff file content hash
- config hash
- schema/tool versions
- base/head refs

Cache is pruned deterministically to a bounded entry count.

## Run records

Each scan writes `/dgl/run-records/<run_id>.json`.

CLI:
- `reach run list`
- `reach run show <id>`
- `reach run export --zip <path>`

## Governance API pagination

New auth-gated endpoints:
- `GET /api/dgl/runs?page&limit&branch&provider`
- `GET /api/dgl/runs/:id`
- `GET /api/dgl/runs/:id/violations?page&limit&severity&type&subsystem&pathQuery`
- `GET /api/dgl/runs/:id/turbulence?page&limit&severity&pathPrefix`

All endpoints return structured 404/401 states and stable ordering for paginated tables.

## Supervisory Intelligence Layer

Reach now adds a supervisory layer on top of Determinism + Divergence with these primitives:

- **Agent Operating Contract (AOC)**: strict output envelope at `dgl/agent-contract.schema.json`; validate via `reach agent validate <file>`.
- **Capability profiling**: telemetry store at `dgl/telemetry/provider-metrics.jsonl` feeding `reach dgl provider-matrix`.
- **Memory cohesion**: `context_snapshot_hash` combines architecture docs + canonical language + intent manifest hashes, exposed via `reach dgl context`.
- **Blast radius estimation**: DGL report includes blast radius score and impact dimensions.
- **Performance guard**: static checks configured in `config/dgl-performance.json`.
- **Security boundary guard**: high-risk zones in `config/dgl-security-boundaries.json` elevate severity + acknowledgement requirements.
- **Economic telemetry**: report includes diff size / convergence loops / optional token & cost metadata, exposed via `reach dgl economics`.
- **Drift forecasting + routing**: Bayesian-like drift estimate included in report and used by `reach dgl route --task-class X --subsystem Y --blast-radius N`.

The ReadyLayer supervisory preset composes determinism + divergence + openapi + performance + security + route integration test checks under release gating.
