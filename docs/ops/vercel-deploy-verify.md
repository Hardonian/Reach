# Vercel Deploy Verification (Arcade / Next.js)

This runbook verifies that the `apps/arcade` Next.js deployment is production-ready for Vercel without route/render regressions.

## Preconditions

- Node 20.x
- Dependencies installed from repository root: `npm install`
- `apps/arcade/vercel.json` present and committed

## 1) Local parity checks (required)

Run from repository root:

```bash
npm --prefix apps/arcade run typecheck
npm --prefix apps/arcade run lint
npm --prefix apps/arcade run build
npm run verify:routes
```

Expected outcomes:

- TypeScript and ESLint pass in `apps/arcade`.
- `next build` succeeds with no route compilation failures.
- Route smoke covers:
  - `/`
  - key marketing route `/roadmap`
  - authenticated area `/dashboard` (must not 500)
  - governance routes `/governance/dgl`, `/governance/cpx`, `/governance/sccl`
  - key API endpoints returning structured JSON responses and no 500

## 2) Vercel project configuration

Set Vercel project root to `apps/arcade` and use default Next.js build output.

Recommended settings:

- **Install Command**: `npm install`
- **Build Command**: `npm run build`
- **Output Directory**: `.next` (default)

## 3) Environment variables

Ensure environment variables are set with least privilege:

- `REACH_CLOUD_ENABLED` (optional; defaults to OSS behavior)
- `REACH_SESSION_COOKIE_NAME`
- `REACH_SESSION_TTL_HOURS`
- `SITE_HOST_OVERRIDE` (optional mode-specific build host)
- Stripe keys only if billing endpoints are enabled

Missing optional cloud variables should degrade gracefully via structured API errors (not hard-500 responses).

## 4) Post-deploy verification

After deployment:

1. Open `/`, `/roadmap`, `/governance/dgl`, `/governance/cpx`, `/governance/sccl`.
2. Confirm no unhandled render error boundaries.
3. Call representative API endpoints (unauthenticated and authenticated) and verify structured JSON errors, no 500.
4. Confirm webhook endpoints that require raw body parsing stay on Node runtime (`runtime = 'nodejs'`).

## 5) Rollback trigger

Rollback immediately if any of the following occur:

- Any governance route returns 500.
- API routes emit unstructured HTML errors for auth/policy failures.
- Build fails on Vercel due to runtime/edge mismatch for billing webhooks.
