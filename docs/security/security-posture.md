# Security Posture

## Baseline Controls

- Tenant-scoped auth and role checks on cloud APIs.
- Structured logging with redaction for sensitive fields.
- Rate limiting on public and ingest-facing endpoints.
- Dependency risk gates (`verify:no-toxic-deps`, `npm audit`).
- Lockfile enforcement (`verify:lockfile` / `npm ci` in CI).
- Secret scanning with SARIF output (`security:scan`).

## Verification Commands

```bash
npm run verify:security
npm run verify:lockfile
npm run security:scan
```

## Release Security Gates

- Release artifacts include SHA256 checksums.
- Artifact manifest (`artifact-manifest.json`) published with each release.
- Release notes are generated from changelog content for traceability.

## Logging & Data Handling

- No plaintext secrets in logs (sanitization rules in logger stack).
- Governance actions are audit-logged with actor and tenant context.
- Alert dedupe suppresses repeated notifications to reduce operator noise.
