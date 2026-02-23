# Reach Cloud Build - Baseline Report **Date:** 2026-02-19

## Current Repository State ### Frameworks & Technologies

- **Backend:** Go 1.25.6 with standard library HTTP server
- **Frontend:** Next.js 16.1.6 (apps/arcade)
- **Database:** SQLite with modernc.org/sqlite driver
- **Storage:** File-based (JSON) + SQLite for structured data
- **Package Manager:** npm with workspaces

### Existing Domain Concepts - **Runs:** Execution units with capabilities and tier-based limits

- **Packs:** Execution packs with manifests and signatures
- **Capsules:** Immutable execution artifacts with Merkle proofs
- **Events:** Event-sourced run history with SSE streaming
- **Jobs:** Durable queue with leasing and idempotency
- **Nodes:** Federated execution nodes with TPM attestation
- **Federation:** Multi-node coordination with reputation scoring
- **Policy:** Capability gates and budget controls
- **Audit:** Append-only audit logs
- **Telemetry:** Metrics and observability

### Services Structure ```

services/
├── runner/ # Main API + job queue + storage
├── billing/ # (exists but minimal)
├── capsule-sync/ # Capsule synchronization
├── connector-registry/
├── ide-bridge/
├── integration-hub/
├── policy-engine/
└── session-hub/

```

### Current Database Schema (SQLite) - `runs` - Run records with tenant isolation
- `events` - Event log (run events)
- `audit` - Audit trail
- `jobs` - Job queue with leasing
- `nodes` - Federated node registry
- `sessions` - Auth sessions

### Baseline Check Results ✅ Protocol validation: PASSED
✅ Go vet: PASSED
✅ Go build: PASSED
⚠️ npm audit: 10 vulnerabilities (1 moderate, 9 high) - non-blocking

### Architecture Notes - Tenant isolation exists via `tenant_id` columns
- Session-based auth with cookies
- API key support not yet implemented
- No PostgreSQL support (SQLite only)
- No Stripe integration
- No workflow builder UI
- No marketplace functionality
- No billing enforcement

### Blockers: None All baseline checks pass. Proceeding with full implementation.

## Phase 0 Update (2026-02-20) ### Additional Packages Installed
- `better-sqlite3` — Node.js synchronous SQLite for cloud control plane
- `@types/better-sqlite3` — TypeScript types
- `zod` — Schema validation for all API inputs
- `stripe` — Stripe billing SDK
- `@xyflow/react` — React Flow for Visual Workflow Builder

### Implementation Plan 1. Cloud DB schema + auth layer in arcade
2. `/api/v1/*` routes replacing mock data with real SQLite persistence
3. Visual Workflow Builder at `/builder` using React Flow
4. Real marketplace publish/browse/install endpoints
5. Stripe billing with webhook raw-body verification
6. Partner docs pages (HuggingFace, Vercel, Stripe)
7. Smoke scripts + RUNBOOK.md
```
