# Security Policy

## Reporting a vulnerability

Please report security issues privately by emailing **security@reach.dev** with:
- affected component(s)
- reproduction steps
- impact assessment
- any proof-of-concept details

Do not open public GitHub issues for undisclosed vulnerabilities.

## Supported surfaces

Reach is a multi-component system. Security-sensitive paths include:
- `services/runner` authentication/session handling, run orchestration, and audit logs.
- `protocol/schemas` contract integrity between clients/tools/services.
- `extensions/vscode` bridge communication and local workspace interactions.
- mobile clients under `apps/mobile/*`.

## Security expectations

- Never log API keys, OAuth tokens, or raw secrets.
- Validate webhook/OAuth inputs and reject malformed payloads.
- Apply least privilege per tenant/session and keep run access tenant-scoped.
- Keep dependencies updated and pinned via each ecosystem's lock/manifest conventions.
