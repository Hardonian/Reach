# Security Policy & Threat Model ## Reporting a vulnerability

Please report security issues privately by emailing **security@reach.dev** with:
- affected component(s)
- reproduction steps
- impact assessment
- any proof-of-concept details

Do not open public GitHub issues for undisclosed vulnerabilities.

## Assets - Session cookies and tenant identity.
- OAuth access/refresh tokens.
- Webhook secrets and delivery integrity metadata.
- Run artifacts, capsule exports/imports, and audit logs.
- Approval/gate decisions for dangerous operations.

## Trust boundaries - Mobile apps / VS Code extension / IDE bridge clients → hub services.
- Hub services (session-hub, integration-hub, capsule-sync) → runner.
- Runner → connectors/plugins and external networks.
- External SaaS providers → integration-hub webhooks.

## Attacker profiles - Malicious user in a valid tenant trying cross-tenant access.
- Compromised client attempting session/token misuse.
- Forged webhook sender and replay attacker.
- Rogue or over-privileged connector/plugin.
- Network attacker attempting request tampering or disclosure.

## Top risks and concrete mitigations - **Spoofing / CSRF**: OAuth callbacks consume single-use state tied to tenant/provider and reject invalid state.
- **Tampering**: Webhook signatures are verified per-provider, with strict timestamp window checks and replay nonce storage.
- **Repudiation**: Audit and event logs are written for OAuth, webhook, and approval flows.
- **Information disclosure**: OAuth tokens are encrypted at rest; auth headers are required; sensitive token material is not logged.
- **Denial of service**: Webhook payload size cap and per-tenant route rate limiting prevent oversized request abuse.
- **Privilege escalation**: Runner requires authenticated session, tenant-scoped run lookups, capability checks, and tenant ownership checks for gate resolution.

## Security expectations - Never log API keys, OAuth tokens, or raw secrets.
- Validate webhook/OAuth inputs and reject malformed or stale payloads.
- Apply least privilege per tenant/session and keep run access tenant-scoped.
- Keep dependencies updated and pinned via each ecosystem's lock/manifest conventions.

## Dependency Firewall Reach implements a production dependency firewall to prevent vulnerable packages from entering the runtime:

### Blocked Packages The following packages are explicitly blocked via npm overrides:

- `clawdbot` - Malicious/untrusted
- `codex` - Name collision prevention
- `connect` - Deprecated middleware
- `request` - Deprecated HTTP client
- `marked` - XSS vulnerabilities (older versions)
- `hono` - Not used in Reach
- `node-llama-cpp` - Optional local LLM only

### Security Checks All CI builds run:

```bash
npm run verify:no-toxic-deps    # Block clawdbot, codex, etc.
npm run verify:prod-install      # Verify clean prod install
npm run security:audit          # Run npm audit on all workspaces
```

See [docs/INSTALL_MODES.md](docs/INSTALL_MODES.md) for installation options.

## Key rotation - Integration Hub token encryption uses AES-GCM master key from `REACH_ENCRYPTION_KEY_BASE64`.
- Rotate by deploying a new key and re-authorizing providers (or migrating stored encrypted blobs in maintenance).
- Webhook secrets should be rotated per provider/tenant and previous deliveries must expire from replay guard window.

## Secret scanning guidance

Use the built-in CI secret scan and run this locally before pushing high-risk changes:

```bash
git grep -nE '(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----|sk_live_[A-Za-z0-9]{10,}|AIza[0-9A-Za-z\-_]{35})' -- .
```

If a credential is found, revoke/rotate immediately and scrub history where needed.

## Archive and capsule hardening

- Capsule import/read paths enforce size limits to reduce denial-of-service risk from oversized payloads.
- Pack archive extraction (zip/tar) rejects traversal paths and enforces both entry-count and unpacked-size limits.
- Remote validation uses bounded request body reads and protocol version checks.
- Registry/network-facing fetch behavior should default to metadata-first validation before heavy downloads.

## Unsafe pack warning posture

`reach run <pack>` warns when pack names are not explicitly marked safe. Treat these warnings as a manual review gate before running packs that can access files, network, or external systems.
