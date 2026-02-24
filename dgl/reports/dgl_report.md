# DGL Report (dgl_1771977041566)

- Base: HEAD~1
- Head: HEAD
- Context Hash: 4309af6cf90dd950a69d696c29506d4d8cdae9c393123ed2b2cca4b13f3e7b2e
- Blast Radius: 100
- Drift Forecast: 89.5%
- Intent Alignment: 60
- Semantic Drift: 70
- OpenAPI Breaking: 0

## Violations
- **WARN** [dependency_graph] package.json#L1 — Review high-risk deps (auth/network/crypto/telemetry) before merge.
- **WARN** [semantic] src/dgl/index.ts#L77 — Verify downstream compatibility and update callers/contracts.
- **WARN** [semantic] src/dgl/types.ts#L1 — Verify downstream compatibility and update callers/contracts.
- **WARN** [semantic] src/dgl/types.ts#L20 — Verify downstream compatibility and update callers/contracts.
- **WARN** [performance] apps/arcade/src/app/api/dgl/runs/[id]/route.ts#L1 — Use async non-blocking IO on route-layer paths.
- **WARN** [performance] apps/arcade/src/app/api/dgl/runs/[id]/turbulence/route.ts#L1 — Use async non-blocking IO on route-layer paths.
- **WARN** [performance] apps/arcade/src/app/api/dgl/runs/[id]/violations/route.ts#L1 — Use async non-blocking IO on route-layer paths.
- **WARN** [performance] apps/arcade/src/app/api/dgl/runs/route.ts#L1 — Use async non-blocking IO on route-layer paths.
- **WARN** [performance] src/cli/reach-cli.ts#L1 — Refactor nested loops or add indexing to reduce worst-case complexity.
- **ERROR** [performance] src/dgl/index.ts#L1 — Refactor nested loops or add indexing to reduce worst-case complexity.
- **ERROR** [performance] src/dgl/openapi-compat.ts#L1 — Refactor nested loops or add indexing to reduce worst-case complexity.