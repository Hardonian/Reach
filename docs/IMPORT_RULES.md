# Import Rules and Architectural Boundaries

Last Updated: 2026-02-22

This document defines the machine-enforced import boundaries between Reach components. Rules here are implemented in [`scripts/validate-import-boundaries.ts`](../scripts/validate-import-boundaries.ts) and [`scripts/validate-oss-purity.ts`](../scripts/validate-oss-purity.ts), both of which run in CI as required checks.

---

## Rule Matrix

### 1. OSS Core Independence

**Path**: `core/`

| Forbidden          | Allowed Alternative         | Reason                  |
| :----------------- | :-------------------------- | :---------------------- |
| `cloud/`           | Interface stubs only        | Core must be cloud-free |
| `services/billing` | `BillingProvider` interface | Billing behind adapter  |
| `stripe`           | OSS stub                    | No payment SDK in core  |
| `auth0`            | `AuthProvider` interface    | Auth behind adapter     |
| `@google-cloud`    | Local FS adapter            | No cloud storage in OSS |
| `aws-sdk`          | `ArtifactStore` interface   | S3 behind adapter       |
| `azure*`           | Local fallback              | No Azure SDK in core    |

---

### 2. CLI Isolation

**Path**: `services/runner/cmd/reachctl`

| Forbidden             | Allowed Alternative      | Reason                     |
| :-------------------- | :----------------------- | :------------------------- |
| `apps/arcade`         | None (CLI is standalone) | CLI must not depend on web |
| `next`                | None                     | No Next.js in CLI          |
| `react` / `react-dom` | None                     | No frontend deps in CLI    |
| `stripe`              | Error stub               | No billing in CLI          |

---

### 3. OSS Paths — Zero Cloud SDK

**Paths**: `core/`, `services/runner/`, `protocol/`

No file in these paths may import:

- `stripe` or `@stripe/*`
- `auth0` or `@auth0/*`
- `@google-cloud/*`
- `aws-sdk` or `@aws-sdk/*`
- `azure-*`

Verified by: `npm run validate:oss-purity`

---

### 4. Web/App Boundaries

**Path**: `apps/*`

| Rule                                                                        | Reason                            |
| :-------------------------------------------------------------------------- | :-------------------------------- |
| Must not directly mutate core execution state                               | Use protocol interfaces           |
| Cloud SDK imports must be inside dynamic imports guarded by `REACH_CLOUD=1` | OSS mode must not load cloud SDKs |
| Must handle `REACH_CLOUD` unset gracefully                                  | Show OSS mode UI without crashing |

---

### 5. Protocol Schemas — Schema-Only Zone

**Path**: `protocol/`

- Must contain only JSON Schema files, NDJSON examples, and documentation.
- No TypeScript, Go, or Rust source code.
- No runtime dependencies.

---

## Enforcement Mechanism

### In CI (Required)

Two scripts enforce these rules automatically:

1. **`scripts/validate-import-boundaries.ts`** — Scans source files for forbidden cross-boundary imports using pattern matching.
2. **`scripts/validate-oss-purity.ts`** — Specifically checks that cloud SDK packages are not imported in OSS-only paths.

Both are run as part of `npm run verify:oss` and are required CI checks.

### Escape Hatch

If a legitimate exception is required (e.g., a cloud adapter stub that must reference a cloud package to satisfy type-checking), document the exception here and in the relevant script's allowlist before merging.

---

## Adding New Rules

1. Add the rule to `scripts/validate-import-boundaries.ts` in the `RULES` array.
2. Document the rule in this file.
3. If the rule affects `validate:oss-purity`, also add it to `FORBIDDEN_SDK_IMPORTS`.
4. Open a PR with label `boundary-rule` for review.

---

## Quick Reference

```bash
# Check all import boundaries
npm run validate:boundaries

# Specifically check OSS purity (no cloud SDKs in OSS paths)
npm run validate:oss-purity

# Full OSS quality gate (includes both above)
npm run verify:oss
```

---

## Related Documents

- [`docs/BOUNDARIES.md`](BOUNDARIES.md) — Layering diagram and architectural principles
- [`docs/OSS_FIRST_COMPONENT_MAP.md`](OSS_FIRST_COMPONENT_MAP.md) — Component classification
- [`docs/OSS_BUILD_GUARANTEE.md`](OSS_BUILD_GUARANTEE.md) — Formal OSS build guarantee
- [`docs/CLOUD_ADAPTER_MODEL.md`](CLOUD_ADAPTER_MODEL.md) — How cloud adapters are structured
