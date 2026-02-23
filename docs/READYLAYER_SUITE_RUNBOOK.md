# ReadyLayer Suite — Operations Runbook

**Last Updated:** 2026-02-21

Four-capability suite: Release Gate · CI Ingestion · Continuous Monitoring · Simulation

---

## 1. Environment Variables

Add these to your `.env.local` (development) or deployment secrets:

```bash
# Core (required)
REACH_CLOUD_ENABLED=true
CLOUD_DB_PATH=/data/reach-cloud.db

# GitHub Integration
GITHUB_WEBHOOK_SECRET=<random 32-byte hex>    # For webhook HMAC validation
GITHUB_APP_ID=<your-app-id>                   # Optional: for Check Runs status API
GITHUB_APP_PRIVATE_KEY=<pem-encoded-key>      # Optional: for Check Runs status API

# ReadyLayer Base URL (used in report links)
READYLAYER_BASE_URL=https://your-domain.com

# Alerts — Email relay (HTTP-based, e.g. Resend, Postmark)
READYLAYER_ALERT_EMAIL_ENDPOINT=https://api.resend.com/emails
READYLAYER_ALERT_EMAIL_API_KEY=re_...
READYLAYER_ALERT_EMAIL_FROM=alerts@your-domain.com
```

---

## 2. Database Migrations

Migrations run automatically on startup via `getDB()` → `applyMigrations()`.

**New tables added (migrations 007–010):**

- `gates` — release gate definitions
- `gate_runs` — per-trigger gate execution records
- `github_installations` — GitHub app/OAuth token cache
- `ci_ingest_runs` — CI pipeline artifact ingestion
- `signals` — monitoring signal definitions
- `monitor_runs` — per-ingestion monitoring events
- `alert_rules` — alert destinations (email/webhook)
- `scenarios` — simulation configurations
- `scenario_runs` — simulation execution records
- `report_shares` — read-only public share links

No manual migration needed — all auto-applied on next startup.

---

## 3. Configure GitHub Integration

### Option A: Minimal OAuth (simplest)

1. Create a GitHub OAuth App at `https://github.com/settings/applications/new`
2. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
3. Set `GITHUB_REDIRECT_URL=https://your-domain/api/v1/auth/github/callback`

### Option B: GitHub App (recommended for Check Runs)

1. Create a GitHub App at `https://github.com/settings/apps/new`
2. Permissions: `checks: write`, `contents: read`, `pull_requests: read`
3. Subscribe to webhook events: `pull_request`, `push`
4. Set `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY`

### Add the Webhook

1. Go to your repo → Settings → Webhooks → Add webhook
2. **Payload URL:** `https://your-domain.com/api/github/webhook`
3. **Content type:** `application/json`
4. **Secret:** value of `GITHUB_WEBHOOK_SECRET`
5. **Events:** Pull requests, Pushes

---

## 4. Enable a Release Gate

1. Open **Settings → Release Gates** (`/settings/release-gates`)
2. Click **Create gate**
3. Enter: gate name, repo owner/name, default branch
4. Add required checks (template/rule/scenario refs) under the gate
5. Set thresholds (pass rate, max violations)
6. Toggle **Enable** on the gate

**Manual trigger via API:**

```bash
curl -X POST https://your-domain/api/v1/gates/:gateId/run \
  -H "Authorization: Bearer rk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"trigger_type": "manual"}'
```

---

## 5. Set Up CI Ingestion

Copy `.github/workflows/readylayer-gate.yml` to your target repository.

Add these secrets to the target repo:

```
READYLAYER_API_KEY     = rk_live_...    (Settings > API Keys, scope: ingest_runs)
READYLAYER_GATE_ID     = gat_...        (from your gate)
READYLAYER_BASE_URL    = https://...    (your domain)
```

**Manual ingest:**

```bash
curl -X POST https://your-domain/api/ci/ingest \
  -H "Authorization: Bearer rk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "commit_sha": "abc1234",
    "branch": "main",
    "ci_provider": "github",
    "gate_id": "gat_...",
    "artifacts": {
      "eval_outputs": [{"test": "passed", "score": 0.95}]
    }
  }'
```

---

## 6. Set Up Monitoring

1. Open **Monitoring** (`/monitoring`) from Dashboard
2. Click **Create monitor**
3. Choose type: `drift`, `latency`, `policy_violation`, `tool_failure`, `regression_rate`
4. Note the `signal_id` from the created monitor

**Send metrics from your agent runtime:**

```bash
curl -X POST https://your-domain/api/monitor/ingest \
  -H "Authorization: Bearer rk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"signal_id": "sig_...", "value": 420.5, "metadata": {"model": "gpt-4o"}}'
```

**Configure alerts** at Settings → Alerts (`/settings/alerts`):

- Channel: `email` (requires `READYLAYER_ALERT_EMAIL_ENDPOINT`) or `webhook`
- Webhook URL: any URL receiving POST JSON (Slack, Discord, n8n, etc.)

---

## 7. Run a Simulation

1. Open **Simulate** (`/simulate`) from Dashboard
2. Enter a name and choose a preset (Model A/B, Latency injection, Tool outage)
3. Click **Run simulation**
4. View side-by-side comparison and recommendation

**Via API:**

```bash
# Create scenario
SCENARIO=$(curl -s -X POST https://your-domain/api/v1/scenarios \
  -H "Authorization: Bearer rk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GPT-4o vs Claude",
    "variants": [
      {"id":"v1", "label":"GPT-4o", "model":"gpt-4o"},
      {"id":"v2", "label":"Claude", "model":"claude-3-5-sonnet"}
    ]
  }' | jq -r '.scenario.id')

# Run simulation
curl -X POST https://your-domain/api/v1/scenarios/$SCENARIO/run \
  -H "Authorization: Bearer rk_live_..."
```

---

## 8. API Keys and Scopes

Create CI-scoped tokens at **Settings → API Keys**:

| Scope          | Purpose                                  |
| -------------- | ---------------------------------------- |
| `ingest_runs`  | CI pipeline ingestion, monitor ingestion |
| `read_reports` | Read gate runs and simulation results    |
| `manage_gates` | Create/update/delete gates (admin only)  |
| `*`            | Full access (default for admin keys)     |

---

## 9. Share a Report

```bash
curl -X POST https://your-domain/api/v1/reports/:runId/share \
  -H "Authorization: Bearer rk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"resource_type": "gate_run", "expires_in_seconds": 604800}'
# Returns: {"share_link": "https://your-domain/reports/share/<slug>"}
```

Share links are public read-only. They expire in 7 days by default (configurable, max 30 days).

---

## 10. UX Simplicity Checks

Run the simplicity validator to ensure nav constraints are not violated:

```bash
npm run validate:simplicity   # advisory mode
AGENTS_ENFORCE=1 npm run validate:simplicity  # strict mode (CI)
```

**Constraints enforced:**

- Primary nav: Home, Playground, Studio, Templates, Docs, Pricing only
- No paragraphs > 2 sentences on key surfaces
- Primary CTA must be "Run demo (free)"
- No orphan routes

---

## 11. Canonical New Routes

| Route                     | Purpose                                   |
| ------------------------- | ----------------------------------------- |
| `/settings/release-gates` | Create/manage gates (Settings > Advanced) |
| `/settings/alerts`        | Configure alert destinations              |
| `/monitoring`             | Agent health dashboard                    |
| `/simulate`               | Simulation lab                            |
| `/reports/:id`            | Canonical gate/simulation report          |
| `/reports/share/:slug`    | Public read-only share                    |

**New API endpoints:**

| Method           | Path                          | Auth                 | Purpose            |
| ---------------- | ----------------------------- | -------------------- | ------------------ |
| GET/POST         | `/api/v1/gates`               | Bearer               | CRUD gates         |
| GET/PATCH/DELETE | `/api/v1/gates/:id`           | Bearer               | Gate detail        |
| POST             | `/api/v1/gates/:id/run`       | Bearer               | Trigger gate       |
| POST             | `/api/github/webhook`         | HMAC                 | GitHub events      |
| POST             | `/api/ci/ingest`              | Bearer (ingest_runs) | CI artifact ingest |
| POST             | `/api/monitor/ingest`         | Bearer (ingest_runs) | Metric ingest      |
| GET/POST         | `/api/v1/signals`             | Bearer               | CRUD signals       |
| GET/POST         | `/api/v1/scenarios`           | Bearer               | CRUD scenarios     |
| POST             | `/api/v1/scenarios/:id/run`   | Bearer               | Trigger simulation |
| GET/POST         | `/api/v1/alerts`              | Bearer               | CRUD alert rules   |
| GET              | `/api/v1/reports/:id`         | Bearer               | Get report         |
| POST             | `/api/v1/reports/:id/share`   | Bearer               | Create share link  |
| GET              | `/api/v1/reports/share/:slug` | Public               | Read shared report |
