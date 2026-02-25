# Reach OSS

Reach is an OSS-first deterministic execution and replay platform for policy-governed runs. It gives teams a reproducible **run → transcript → verify → replay** lifecycle with evidence artifacts and stable fingerprints.

## What you get in OSS

- Deterministic run execution and replay verification.
- Local evidence viewer (`apps/arcade`) for transcript inspection.
- Policy gate validation and conformance fixtures.
- Route and boundary checks to prevent hard-500 regressions.

## Cloud/Enterprise capabilities

- Multi-tenant account and org management.
- Hosted key custody and signing orchestration.
- Managed audit stream retention and enterprise operations.

See the full matrix: [docs/oss-vs-enterprise.md](docs/oss-vs-enterprise.md).

## Quickstart (TTFV)

```bash
npm install
npm run verify:oss
npm run verify:routes
```

Then start the demo viewer:

```bash
cd apps/arcade
npm install
npm run dev
```

Open `http://localhost:3000/demo/evidence-viewer` and load the sample run.

Detailed setup: [docs/quickstart.md](docs/quickstart.md).

## Support and community

- Contributing guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security reporting: [SECURITY.md](SECURITY.md)
- Issue templates: [.github/ISSUE_TEMPLATE](.github/ISSUE_TEMPLATE)

## Reliability guardrails

- OSS and language gates: `npm run verify:oss`
- Root cleanliness gate: `npm run verify:root`
- Route safety gate: `npm run verify:routes`
- Import boundaries gate: `npm run validate:boundaries`
