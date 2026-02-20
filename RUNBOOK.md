# Reach Cloud Platform — RUNBOOK

**Branch:** `claude/reach-cloud-platform-wVvKb`
**Last Updated:** 2026-02-20

---

## Table of Contents
1. [Local Development (One Command)](#local-development)
2. [Feature Flags](#feature-flags)
3. [Database Bootstrap](#database-bootstrap)
4. [Dev Seed](#dev-seed)
5. [Running Services](#running-services)
6. [Smoke Tests](#smoke-tests)
7. [Deploy to Vercel](#deploy-to-vercel)
8. [Deploy Go Runner (Docker)](#deploy-go-runner)
9. [Stripe Webhook Setup](#stripe-webhook-setup)
10. [Environment Variable Reference](#environment-variable-reference)
11. [Troubleshooting](#troubleshooting)

---

## Local Development

### Prerequisites
- Node.js 18–22
- Go 1.24+ (for runner service)
- npm 9+

### One-Command Start

```bash
# From repo root
npm install

# Start Next.js console + API (port 3000)
REACH_CLOUD_ENABLED=true npm run dev -w arcade

# In a separate terminal — start Go runner (port 8080)
cd services/runner && go run ./cmd/reach-serve
```

Then open http://localhost:3000/cloud

---

## Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `REACH_CLOUD_ENABLED` | unset | Enable all `/api/v1/*` cloud endpoints |
| `MARKETPLACE_ENABLED` | unset | Reserved for future marketplace gating |
| `BILLING_ENABLED` | unset | Enable Stripe billing endpoints |

All flags must be set to `"true"` (exact string).

---

## Database Bootstrap

The cloud database is auto-created on first request when `REACH_CLOUD_ENABLED=true`.

```bash
# Default path (from apps/arcade/ working directory):
./reach-cloud.db

# Custom path:
export CLOUD_DB_PATH=/data/reach-cloud.db

# Run migrations manually (happens automatically on startup):
REACH_CLOUD_ENABLED=true node -e "require('./src/lib/cloud-db').seedDevData()"
```

Schema version is tracked in the `schema_version` table. Migrations are idempotent.

---

## Dev Seed

Seed a dev tenant, user, sample workflows, and marketplace packs:

```bash
# Via API (server must be running)
curl -X POST http://localhost:3000/api/v1/seed

# Returns:
# {
#   "ok": true,
#   "tenant": { "id": "ten_...", "slug": "reach-dev" },
#   "user": { "email": "admin@reach.dev" },
#   "api_key": "rk_live_..."  ← Save this! Shown only once.
# }
```

**Default credentials (after seed):**
- Email: `admin@reach.dev`
- Password: `dev-password-local`

The seed is idempotent — safe to run multiple times.

---

## Running Services

### Next.js Console + API

```bash
cd apps/arcade
REACH_CLOUD_ENABLED=true npm run dev
# → http://localhost:3000
```

### Go Runner (execution backend)

```bash
cd services/runner
go run ./cmd/reach-serve --port 8080
# → http://localhost:8080
```

### Docker Compose (all services)

```bash
# Development
docker compose -f docker-compose.dev.yml up

# With monitoring
docker compose --profile monitoring up

# With Redis cache
docker compose --profile cache up
```

---

## Smoke Tests

Requires the Next.js server to be running with `REACH_CLOUD_ENABLED=true`.

```bash
# Run all cloud smoke tests
REACH_CLOUD_ENABLED=true bash scripts/smoke-cloud.sh

# Against a different host
REACH_CLOUD_BASE=https://staging.reach.dev bash scripts/smoke-cloud.sh
```

The smoke test covers:
- Seed endpoint
- Login / session auth
- Me (API key auth)
- Tenant creation
- Project creation
- Workflow creation + retrieval
- Workflow run execution
- Run detail fetch
- Marketplace browse + publish
- Billing status
- API key create/list
- Audit log

---

## Deploy to Vercel

### Quick deploy

```bash
npm i -g vercel
cd apps/arcade
vercel
```

### Production deploy

```bash
vercel --prod
```

### Required environment variables (set in Vercel dashboard)

```
REACH_CLOUD_ENABLED=true
CLOUD_DB_PATH=/tmp/reach-cloud.db
REACH_SESSION_COOKIE_NAME=reach_session
REACH_SESSION_TTL_HOURS=24
BILLING_ENABLED=true
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...
```

> **Note:** SQLite at `/tmp` is ephemeral on Vercel. For persistent storage, use Turso/LibSQL and update `CLOUD_DB_PATH`.

### vercel.json (already present in repo root)

The existing `vercel.json` configures the build. The billing webhook is explicitly set to `nodejs20.x` runtime for raw body access.

---

## Deploy Go Runner (Docker)

```bash
# Build
docker build -t reach-runner .

# Run
docker run -p 8080:8080 \
  -e REACH_DATA_DIR=/data \
  -v reach-data:/data \
  reach-runner

# Or with compose
docker compose up runner
```

The runner exposes:
- `GET /healthz` — health check
- `POST /v1/runs` — create run
- All other v1 endpoints (see `services/runner/internal/api/server.go`)

---

## Stripe Webhook Setup

### Local testing

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward events to local server
stripe listen --forward-to localhost:3000/api/v1/billing/webhook

# Copy the printed signing secret and set:
export STRIPE_WEBHOOK_SECRET=whsec_test_...

# Trigger test events
stripe trigger customer.subscription.created
stripe trigger invoice.paid
```

### Production

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/v1/billing/webhook`
3. Subscribe to: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
4. Copy signing secret → set `STRIPE_WEBHOOK_SECRET`

---

## Environment Variable Reference

```bash
# ── REQUIRED for Cloud ─────────────────────────────────────────
REACH_CLOUD_ENABLED=true
CLOUD_DB_PATH=./reach-cloud.db          # SQLite path

# ── Session ────────────────────────────────────────────────────
REACH_SESSION_COOKIE_NAME=reach_session
REACH_SESSION_TTL_HOURS=24

# ── Redis (optional, rate limiting) ───────────────────────────
REDIS_URL=redis://localhost:6379

# ── Billing (optional) ─────────────────────────────────────────
BILLING_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# ── HuggingFace (optional) ─────────────────────────────────────
HF_API_TOKEN=hf_...
HF_BASE_URL=https://api-inference.huggingface.co
HF_TIMEOUT_MS=30000
HF_MAX_RETRIES=3

# ── Go Runner ──────────────────────────────────────────────────
REACH_RUNNER_URL=http://localhost:8080  # Cloud API → runner wiring
REACH_DATA_DIR=./data
REACH_EXECUTION_TIMEOUT=5m

# ── Feature Flags ─────────────────────────────────────────────
MARKETPLACE_ENABLED=true
```

---

## Troubleshooting

### "REACH_CLOUD_ENABLED is not set"
Set the env var: `REACH_CLOUD_ENABLED=true npm run dev -w arcade`

### "Billing not enabled"
Set `BILLING_ENABLED=true` AND `STRIPE_SECRET_KEY`.

### Build fails: `better-sqlite3` native bindings
On Vercel/serverless, use LibSQL. Locally, ensure Node.js ≥ 18 and run `npm install` from repo root.

### Session not persisting between requests
SQLite is used for sessions. If `CLOUD_DB_PATH` points to `/tmp`, it may be cleared between serverless cold starts. Use Turso for persistent sessions in production.

### TypeScript error on `@xyflow/react`
Run `npm install` from repo root (not just apps/arcade). The builder uses `@xyflow/react` which must be hoisted.

### Go runner: "dial tcp localhost:8080: connection refused"
The cloud API tries to forward workflow runs to the Go runner. This is optional — the system degrades gracefully to simulated execution if the runner is not available.

### Stripe webhook: "No signatures found matching the expected signature"
- Ensure `STRIPE_WEBHOOK_SECRET` matches the endpoint's signing secret in Stripe dashboard
- When using Stripe CLI for local testing, use the CLI's printed secret (not the dashboard one)
- Verify the raw body is not being transformed (Next.js App Router reads `req.arrayBuffer()` directly)

---

## API Quick Reference

All endpoints require `REACH_CLOUD_ENABLED=true`.

Auth: `Authorization: Bearer rk_live_...` (API key) or session cookie.
Multi-tenant: `X-Tenant-Id: ten_...` header (or from session).

```
POST   /api/v1/auth/register        Create account + tenant
POST   /api/v1/auth/login           Login
POST   /api/v1/auth/logout          Logout
GET    /api/v1/auth/me              Current user + tenant

GET    /api/v1/tenants              List tenants
POST   /api/v1/tenants              Create tenant

GET    /api/v1/projects             List projects
POST   /api/v1/projects             Create project
GET    /api/v1/projects/:id         Get project

GET    /api/v1/workflows            List workflows
POST   /api/v1/workflows            Create workflow
GET    /api/v1/workflows/:id        Get workflow
PATCH  /api/v1/workflows/:id        Update workflow
POST   /api/v1/workflows/:id/runs   Run workflow (entitlement-gated)
GET    /api/v1/workflows/:id/runs   List runs for workflow

GET    /api/v1/workflow-runs        List all runs
GET    /api/v1/workflow-runs/:id    Get run detail

GET    /api/v1/api-keys             List API keys
POST   /api/v1/api-keys             Create API key
DELETE /api/v1/api-keys/:id         Revoke API key

GET    /api/v1/marketplace          Browse packs
GET    /api/v1/marketplace/:id      Pack detail
POST   /api/v1/marketplace/publish  Publish pack
POST   /api/v1/marketplace/:id/install  Install pack
POST   /api/v1/marketplace/:id/review   Review pack
POST   /api/v1/marketplace/:id/report   Report pack

GET    /api/v1/billing              Plan + usage
POST   /api/v1/billing/checkout     Create Stripe checkout
POST   /api/v1/billing/portal       Open billing portal
POST   /api/v1/billing/webhook      Stripe webhook (raw body)

GET    /api/v1/audit                Audit log (immutable)

POST   /api/v1/seed                 Dev seed (disabled in production)
```

---

## Known Limitations

1. **SQLite on Vercel:** Session and DB state is ephemeral per-instance. Use Turso for production.
2. **Workflow execution:** Cloud API simulation is used when the Go runner is unavailable. For real execution, run `services/runner` alongside the Next.js app.
3. **SSO:** Team/Enterprise SSO is a UI placeholder — backend not yet implemented.
4. **RAG collections:** Metadata-only in v1. Vector store integration is local-first (runner).
5. **Playwright E2E:** Requires `@playwright/test` and a running server. Run `npx playwright test` after installing deps.
6. **Marketplace security scan:** Automated scans are heuristic (field checks). Full static analysis is a roadmap item.
