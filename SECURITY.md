# Security Policy

## Reporting a Vulnerability

Please report vulnerabilities privately to `security@reach.dev`.

Include:
- affected component(s)
- reproduction steps
- impact
- proof-of-concept details (if available)

Do not open a public GitHub issue for undisclosed vulnerabilities.

## Disclosure Process

1. We acknowledge reports within 72 hours.
2. We triage severity and scope.
3. We prepare a fix and coordinate disclosure timing.
4. We publish remediation notes in release notes when applicable.

## Security Baseline (OSS)

- Least privilege by default.
- Deterministic replay and proof verification remain mandatory.
- No secrets in logs.
- OSS mode must run with enterprise-only env vars unset.

## Secret Scanning Guidance

Before opening a PR, run:

```bash
npm run verify:no-toxic-deps
npm run verify:prod-install
```

CI also runs pattern-based secret scanning for tracked files.

## Artifact and Bundle Hardening

Reach enforces the following on artifact/bundle ingest and verification paths:

- archive path traversal entries are rejected (`..`, absolute paths, drive-letter paths)
- per-entry size limit
- total bundle size limit
- max archive entry count
- capsule file size limit

These checks are enforced in CLI code paths and tested in CI.

## Registry and Pack Safety

- Registry index handling is metadata-first.
- Pack install paths emit warnings for unverified/unsigned metadata.
- Treat unverified packs as unsafe until reviewed and verified.

## Dependency Firewall

Reach blocks known toxic/deprecated packages at CI/review time.

Examples include:
- `clawdbot`
- `codex`
- `connect`
- `request`
- `marked`
- `hono`
- `node-llama-cpp`

## Operational Expectations

- Validate OAuth/webhook inputs and reject malformed payloads.
- Keep tenant/session scope checks in place for protected operations.
- Rotate provider secrets and encryption keys regularly.
- Use `reach bugreport` for redacted diagnostics when filing issues.
