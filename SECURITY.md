# Security Policy & Threat Model

## Reporting a vulnerability

Please report security issues privately by emailing **security@reach.dev** with:
- affected component(s)
- reproduction steps
- impact assessment
- any proof-of-concept details

Do not open public GitHub issues for undisclosed vulnerabilities.

## Assets

- Session cookies and tenant identity.
- OAuth access/refresh tokens.
- Webhook secrets and delivery integrity metadata.
- Run artifacts, capsule exports/imports, and audit logs.
- Approval/gate decisions for dangerous operations.

## Trust boundaries

- Mobile apps / VS Code extension / IDE bridge clients → hub services.
- Hub services (session-hub, integration-hub, capsule-sync) → runner.
- Runner → connectors/plugins and external networks.
- External SaaS providers → integration-hub webhooks.

## Attacker profiles

- Malicious user in a valid tenant trying cross-tenant access.
- Compromised client attempting session/token misuse.
- Forged webhook sender and replay attacker.
- Rogue or over-privileged connector/plugin.
- Network attacker attempting request tampering or disclosure.

## Top risks and concrete mitigations

- **Spoofing / CSRF**: OAuth callbacks consume single-use state tied to tenant/provider and reject invalid state.
- **Tampering**: Webhook signatures are verified per-provider, with strict timestamp window checks and replay nonce storage.
- **Repudiation**: Audit and event logs are written for OAuth, webhook, and approval flows.
- **Information disclosure**: OAuth tokens are encrypted at rest; auth headers are required; sensitive token material is not logged.
- **Denial of service**: Webhook payload size cap and per-tenant route rate limiting prevent oversized request abuse.
- **Privilege escalation**: Runner requires authenticated session, tenant-scoped run lookups, capability checks, and tenant ownership checks for gate resolution.

## Security expectations

- Never log API keys, OAuth tokens, or raw secrets.
- Validate webhook/OAuth inputs and reject malformed or stale payloads.
- Apply least privilege per tenant/session and keep run access tenant-scoped.
- Keep dependencies updated and pinned via each ecosystem's lock/manifest conventions.

## Key rotation

- Integration Hub token encryption uses AES-GCM master key from `REACH_ENCRYPTION_KEY_BASE64`.
- Rotate by deploying a new key and re-authorizing providers (or migrating stored encrypted blobs in maintenance).
- Webhook secrets should be rotated per provider/tenant and previous deliveries must expire from replay guard window.
