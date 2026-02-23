# Reach External Integration Hub

Integration Hub is a multi-tenant service that brokers OAuth, verifies incoming webhooks, normalizes provider events, triggers Reach runner workflows, dispatches notifications, and writes audit logs.

## Supported providers

- Slack (OAuth + webhook + approvals)
- Google Workspace (Gmail/Calendar webhook normalization)
- GitHub (PR webhook triggers)
- Jira (issue transition task events)

## API

- `GET /v1/integrations`
- `POST /v1/integrations/{provider}/oauth/start`
- `GET /v1/integrations/{provider}/oauth/callback`
- `POST /webhooks/slack|github|google|jira`
- `POST /v1/notifications`
- `POST /v1/integrations/{provider}/approve`
- `GET /v1/events`
- `GET /v1/audit`

All endpoints require `X-Reach-Tenant` header for strict tenant isolation.

## Security guidance

- OAuth access and refresh tokens are encrypted at rest using AES-256-GCM (`INTEGRATION_HUB_ENCRYPTION_KEY`, base64 encoded 32-byte key).
- Webhook signatures are verified:
  - Slack: `X-Slack-Signature` + timestamp with `v0:{ts}:{body}` digest.
  - GitHub: `X-Hub-Signature-256` HMAC SHA-256.
  - Google/Jira: `X-Reach-Signature` HMAC SHA-256.
- Replay protection is enforced via `X-Reach-Delivery` nonce persisted in `replay_guard`.
- Built-in per-tenant path rate limiting prevents burst abuse.

## OAuth setup

Set provider credentials and redirect URIs:

- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`
- `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET`, `JIRA_REDIRECT_URI`

Configure dev secrets:

- `WEBHOOK_SECRET_SLACK`
- `WEBHOOK_SECRET_GITHUB`
- `WEBHOOK_SECRET_GOOGLE`
- `WEBHOOK_SECRET_JIRA`

## Token rotation

Use helper scripts:

- `tools/integration-hub/generate-encryption-key.sh`
- `tools/integration-hub/rotate-webhook-secret.sh <provider> <tenant>`

## Running locally

```bash
cd services/integration-hub
INTEGRATION_HUB_ENCRYPTION_KEY="$(tools/integration-hub/generate-encryption-key.sh)" \
RUNNER_INTERNAL_URL="http://localhost:8080" \
go run ./cmd/integration-hub
```
