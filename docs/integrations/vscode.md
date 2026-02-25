# VS Code + IDE SCCL Integration Contract

## API contract

IDE clients should call:

- `GET /api/sccl/status`
- `POST /api/sccl/lease/acquire`
- `POST /api/sccl/lease/release`
- `POST /api/sccl/apply`
- `GET /api/sccl/runs?page=<n>&pageSize=<m>`

All requests must include authenticated session context and actor metadata.

## Patch Pack format

```json
{
  "pack_id": "pack_123",
  "base_sha": "<sha>",
  "actor": { "user_id": "dev@acme", "device_id": "workstation", "agent_id": "vscode" },
  "files": [{ "path": "src/example.ts", "patch": "@@ -1 +1 @@" }]
}
```

## UX requirements

- Show stale base and dirty state before apply.
- Block apply unless lease exists.
- Show gate state and recent run records.
- Open `/governance/source-control` for full coherence diagnostics.

## Generic OSS AI IDE usage

```bash
curl -H 'x-reach-auth: demo' http://localhost:3000/api/sccl/status
curl -X POST -H 'Content-Type: application/json' -H 'x-reach-auth: demo' \
  -d @dgl/sccl/fixtures/patchpack.stale-base.json \
  http://localhost:3000/api/sccl/apply
```
