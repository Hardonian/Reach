# Import Rules and Boundaries

This document defines the architectural boundaries between Reach components. These rules are enforced by `scripts/validate-import-boundaries.ts` and verify during CI.

## Primary Boundaries

### 1. Core Independence
**Path**: `core/`
**Rules**:
- Cannot import from `cloud/` or `services/billing`.
- Cannot depend on third-party cloud SDKs (Stripe, Auth0, etc.).
- Must remain pure deterministic logic.

### 2. CLI Isolation
**Path**: `services/runner/cmd/reachctl`
**Rules**:
- Cannot import from `apps/arcade` or any frontend-specific modules.
- Should minimize shared state with the runner service.

### 3. Web/Web-App Boundaries
**Path**: `apps/`
**Rules**:
- Cannot directly mutate core execution state.
- Must interact with core via defined registry or protocol interfaces.

### 4. Cloud Adapters
**Rules**:
- Cloud-specific code must be isolated behind the `REACH_CLOUD` environment flag.
- Adapters must implement standard interfaces defined in `core`.

## Enforcement

Violations will fail the build in Phase 5: `validate:boundaries`.
To run locally:
```bash
npm run validate:boundaries
```
