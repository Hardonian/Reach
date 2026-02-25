# Reach + ReadyLayer Control Planes Audit

## Coverage Summary

| Control Plane | Exists | Mutates Code | Shared SCCL Sync | Identity Model | Lease Use | Run Linkage | Split-brain Risk |
|---|---|---:|---:|---|---:|---:|---|
| Reach CLI (`services/runner/cmd/reachctl`) | ✅ | ✅ | Partial | local user + run context | Partial | ✅ | Medium (local-first flows) |
| ReadyLayer web (`apps/arcade`) | ✅ | ✅ (workflow/API actions) | Partial | session/API key tenant context | ✅ | ✅ | Medium |
| Backend services (`services/*`) | ✅ | ✅ | Partial | service identity | Partial | Partial | Medium |
| IDE integrations (`extensions/vscode*`) | ✅ | ✅ | Partial | editor identity | ❌ | Partial | High |
| Web agent APIs (`apps/arcade/src/app/api/*`) | ✅ | ✅ | Partial | tenant/API-key/session | ✅ | Partial | Medium |

## What Already Exists
- DGL, CPX, and SCCL runtime components with CLI and report surfaces.
- GitHub webhook route and governance endpoints.
- Policy-engine service and governance DSL in runner.

## Half-Baked / Missing Areas
- Single shared control-plane mutation contract is not yet universal across CLI/web/IDE.
- Reconciliation loop is documented but not fully centralized as one worker service.
- Artifact registry API endpoints are not uniformly exposed under `/api/artifacts`.
- CPX needed structured resolve workflow for conflict packets and merge-plan generation.

## Risk Assessment
1. **Split-brain update risk:** multiple mutation paths without one canonical lease arbitration layer.
2. **Identity drift:** mixed local/session/service identities without one normalized attribution schema.
3. **Governance bypass risk:** without centralized policy document wiring across every entrypoint.

## Recommended Immediate Actions
1. Enforce one governance-policy JSON contract in all control planes.
2. Require run_id + tenant_id on all mutation audit records.
3. Promote CPX resolve workflow output into PR checks/comments.
