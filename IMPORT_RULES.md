# Import Boundary Rules

**Enforced by**: `scripts/validate-import-boundaries.ts`

To maintain the integrity of the Reach architecture, strict import boundaries are enforced between modules.

## 1. Determinism Isolation

The `determinism` package is the cryptographic core of Reach. It must remain pure.

- **Scope**: `services/runner/internal/determinism`
- **Cannot Import**:
  - `services/runner/internal/api` (No HTTP dependencies)
  - `services/runner/internal/jobs` (No execution state dependencies)
  - `services/runner/internal/storage` (No DB dependencies)

## 2. Pack Independence

Packs are static definitions. They should not depend on runtime execution logic.

- **Scope**: `services/runner/internal/pack`
- **Cannot Import**:
  - `services/runner/internal/jobs`

## 3. Cloud Isolation

The Core Runner is OSS-first and must not depend on proprietary cloud services.

- **Scope**: `services/runner/internal/*` (excluding `adapters/cloud`)
- **Cannot Import**:
  - `services/cloud`
  - Any external Cloud SDK (AWS, GCP, Azure, Stripe)

## Remediation

If you encounter a boundary violation:

1. Define an **Interface** in the consumer package.
2. Implement the interface in the dependency or an adapter.
3. Inject the implementation at runtime (in `main.go`).
