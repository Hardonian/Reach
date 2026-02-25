# Governance Threat Model

## Assets
- Run records and event logs
- Policy decisions and escalation history
- CPX reports and merge plans
- Artifact blobs and manifests

## Primary Threats
1. Secret leakage in artifacts, logs, or SARIF payloads.
2. Cross-tenant data reads via weak filtering.
3. Privilege escalation through broad git-host tokens.
4. Unsafe auto-merge of high-risk trust-boundary changes.

## Controls
- Redaction before persistence/export for logs and artifacts.
- Tenant-scoped query filters and audit logs for all governance actions.
- Short-lived installation/OIDC tokens with minimum scopes.
- Mandatory human signoff on high-risk zones.

## Validation Checklist
- Run `npm run verify:oss`, `npm run validate:boundaries`, and `npm run validate:language` before merge.
- Confirm no webhook secret values appear in emitted logs.
- Confirm pagination and deterministic ordering on list endpoints.
