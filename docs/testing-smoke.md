# Smoke Tests

## Overview

Route smoke tests verify that all canonical routes render without hard 500 errors. They run as a lightweight Node.js script — no Playwright dependency required.

## Running Locally

```bash
# 1. Build and start the dev server
npm run build -w arcade
cd apps/arcade && npx next start -p 3000 &

# 2. Run smoke tests
BASE_URL=http://localhost:3000 node tests/smoke/routes.test.mjs
```

## What Gets Tested

### Public Routes (must return 200)

- `/`, `/architecture`, `/transparency`, `/marketplace`
- `/docs`, `/faq`, `/pricing`, `/governance`

### Console Routes (200 or auth redirect accepted)

- `/console`, `/console/agents`, `/console/runners`
- `/console/evaluation`, `/console/governance`, `/console/datasets`
- `/console/cost`, `/console/ecosystem`, `/console/integrations`
- `/console/artifacts`, `/console/alerts`, `/console/traces`

## CI

Smoke tests run automatically on PRs via the `route-smoke` job in `.github/workflows/ci.yml`.

## Adding New Routes

Add entries to the `PUBLIC_ROUTES` or `CONSOLE_ROUTES` arrays in `tests/smoke/routes.test.mjs`.
