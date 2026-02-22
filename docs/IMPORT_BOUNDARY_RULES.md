# Import Boundary Rules

> **Audit Date**: 2026-02-22
> **Enforcement**: CI via `scripts/validate-import-boundaries.ts` and `scripts/validate-oss-purity.ts`
> **Status**: ACTIVE — Violations block merge

---

## Table of Contents

1. [Boundary Principles](#1-boundary-principles)
2. [Rule Definitions](#2-rule-definitions)
3. [Directory Pattern Matrix](#3-directory-pattern-matrix)
4. [Valid vs Invalid Import Examples](#4-valid-vs-invalid-import-examples)
5. [Feature Flag Requirements](#5-feature-flag-requirements)
6. [Enforcement Mechanisms](#6-enforcement-mechanisms)
7. [Violation Resolution Procedures](#7-violation-resolution-procedures)

---

## 1. Boundary Principles

### P1: Local-First Core
The deterministic engine MUST function entirely offline. No network calls, no cloud SDKs, no external service dependencies in core paths.

### P2: Interface Isolation
Cloud features MUST NEVER be imported directly by OSS core modules. Cloud functionality MUST be accessed via adapter interfaces or behind feature flags.

### P3: Deterministic Heart
The `services/runner` and `crates/engine` are the deterministic heart. External side effects such as network calls, cloud storage, and billing MUST be gated.

### P4: Graceful Degradation
When cloud features are unavailable, the system MUST fall back to OSS-mode behavior. No hard-500 errors for missing cloud credentials.

---

## 2. Rule Definitions

### Rule 1: Core CANNOT Import Cloud Modules

**Scope**: `core/`, `crates/`

**Forbidden imports**:
- Any module from `services/billing/`
- Any module from `apps/arcade/src/lib/cloud-*`
- Any cloud SDK: `stripe`, `auth0`, `@google-cloud`, `aws-sdk`, `azure-sdk`
- Any module from `apps/` web-specific code

**Rationale**: Core modules define the deterministic execution engine. Cloud dependencies would break offline functionality and introduce non-deterministic behavior.

### Rule 2: CLI CANNOT Import Web Modules

**Scope**: `services/runner/cmd/reachctl/`, `services/runner/cmd/reach-eval/`, `services/runner/cmd/reach-serve/`

**Forbidden imports**:
- Any module from `apps/arcade/`
- Any frontend framework: `next`, `react`, `react-dom`
- Any browser APIs or UI libraries

**Rationale**: CLI tools must be lightweight, headless, and runnable in CI environments without browser dependencies.

### Rule 3: Web CANNOT Mutate Engine State Directly

**Scope**: `apps/arcade/`, `extensions/vscode/`

**Forbidden patterns**:
- Direct import of `crates/engine/` Rust source
- Direct import of `core/evaluation/` Go source
- Direct mutation of runner internal state
- Bypassing the API/SDK layer to modify engine internals

**Required**: Web apps MUST interact with the engine via:
- SDK clients: `sdk/ts/`, `sdk/python/`
- Protocol contracts: `protocol/`
- HTTP APIs exposed by `services/runner/`

**Rationale**: The web layer is a presentation concern. Engine state must be managed by the engine, not the UI.

### Rule 4: Cloud Code MUST Be Behind Feature Flags

**Scope**: All cloud-specific code in `apps/arcade/src/lib/`

**Required feature flags**:

| Cloud Feature | Flag | Required |
|---------------|------|----------|
| Cloud DB and auth | `REACH_CLOUD_ENABLED` | Yes |
| Stripe billing | `BILLING_ENABLED` + `STRIPE_SECRET_KEY` | Yes |
| Redis caching | `REDIS_URL` | Optional, graceful fallback |
| GitHub integration | `GITHUB_CLIENT_ID` | Optional |
| SMTP alerting | `SMTP_HOST` | Optional |

**Required behavior when disabled**:
- Throw `CloudDisabledError` or equivalent
- Fall back to local/in-memory alternatives
- Never crash or hard-500

### Rule 5: OSS Paths Forbid Cloud SDKs

**Scope**: `core/`, `services/runner/`, `protocol/`

**Forbidden SDK imports** (enforced by `scripts/validate-oss-purity.ts`):
- `stripe`
- `auth0`
- `@google-cloud`
- `aws-sdk`
- `azure-sdk`

**Override**: Set `REACH_CLOUD=1` environment variable to skip this validation (for enterprise builds only).

### Rule 6: Packages and SDKs CANNOT Import Services

**Scope**: `sdk/`, `protocol/`

**Forbidden imports**:
- Any module from `services/billing/`
- Any module from `services/capsule-sync/`
- Any module from `apps/`

**Rationale**: SDKs and protocol schemas must be standalone, portable, and free of service-layer dependencies.

### Rule 7: Services CANNOT Import Deprecated Modules

**Scope**: All `services/` directories EXCEPT `services/billing/` itself

**Forbidden imports**:
- `services/billing/` (DEPRECATED since 2026-02-18)

**Current violations**:
- `services/capsule-sync/` imports `services/billing/tier` — see [ARCHITECTURE_LOCK.md](ARCHITECTURE_LOCK.md) Violation 1

**Required fix**: Replace billing tier imports with configuration-flag-based feature gating.

---

## 3. Directory Pattern Matrix

This matrix defines which directories can import from which other directories.

| Source (importer) | core/ | crates/ | services/runner/ | services/billing/ | apps/arcade/ cloud | apps/arcade/ oss | sdk/ | protocol/ |
|-------------------|-------|---------|------------------|--------------------|---------------------|-------------------|------|-----------|
| **core/** | Yes | No | No | NO | NO | No | No | Yes |
| **crates/** | No | Yes | No | NO | NO | No | No | No |
| **services/runner/** | No | No | Yes | NO | NO | No | No | Yes |
| **services/capsule-sync/** | No | No | No | VIOLATION | NO | No | No | Yes |
| **apps/arcade/ oss** | No | No | No | No | No | Yes | Yes | Yes |
| **apps/arcade/ cloud** | No | No | No | No | Yes | Yes | Yes | Yes |
| **sdk/** | No | No | No | NO | NO | No | Yes | Yes |
| **protocol/** | No | No | No | NO | NO | No | No | Yes |
| **extensions/vscode/** | No | No | No | No | No | No | Yes | Yes |
| **pack-devkit/** | No | No | No | No | No | No | No | Yes |
| **internal/packkit/** | No | No | No | No | No | No | No | No |

Legend:
- **Yes**: Allowed
- **No**: Not applicable or unnecessary
- **NO**: Explicitly forbidden
- **VIOLATION**: Currently violating this rule

---

## 4. Valid vs Invalid Import Examples

### Rule 1: Core CANNOT Import Cloud

**VALID** - Core importing standard library:
```go
// core/evaluation/engine.go
import (
    "context"
    "encoding/json"
    "time"
)
```

**INVALID** - Core importing billing:
```go
// core/evaluation/engine.go — THIS IS FORBIDDEN
import "reach/services/billing/tier"
```

**INVALID** - Core importing cloud SDK:
```go
// core/evaluation/engine.go — THIS IS FORBIDDEN
import "github.com/stripe/stripe-go/v81"
```

### Rule 2: CLI CANNOT Import Web

**VALID** - CLI importing runner internals:
```go
// services/runner/cmd/reach-serve/main.go
import (
    "reach/services/runner/internal/jobs"
    "reach/services/runner/internal/storage"
)
```

**INVALID** - CLI importing web framework:
```go
// services/runner/cmd/reachctl/main.go — THIS IS FORBIDDEN
import "reach/apps/arcade"
```

### Rule 3: Web uses SDK, not engine directly

**VALID** - Web app using SDK:
```typescript
// apps/arcade/src/lib/some-feature.ts
import { ReachClient } from '@reach/sdk';
```

**VALID** - Web app using protocol types:
```typescript
// apps/arcade/src/components/SomeWidget.tsx
import type { RunEvent } from '@/lib/runtime/types';
```

**INVALID** - Web app importing engine internals:
```typescript
// apps/arcade/src/lib/some-feature.ts — THIS IS FORBIDDEN
import { WorkflowMachine } from '../../../crates/engine/src/state_machine';
```

### Rule 4: Cloud code behind flags

**VALID** - Guarded cloud access:
```typescript
// apps/arcade/src/lib/db/connection.ts
export function getDB(): Database.Database {
  if (!isCloudEnabled()) throw new CloudDisabledError();
  // ...
}
```

**VALID** - Guarded billing:
```typescript
// apps/arcade/src/lib/stripe.ts
export function getStripe(): Stripe {
  if (!isBillingEnabled()) throw new BillingDisabledError();
  // ...
}
```

**INVALID** - Unguarded cloud access:
```typescript
// THIS IS FORBIDDEN — no feature flag check
const db = new Database('reach-cloud.db');
```

### Rule 5: SDK isolation

**VALID** - SDK importing only protocol types:
```typescript
// sdk/ts/src/index.ts
import type { RunEvent } from './types';
```

**INVALID** - SDK importing service:
```typescript
// sdk/ts/src/index.ts — THIS IS FORBIDDEN
import { billing } from '../../services/billing';
```

---

## 5. Feature Flag Requirements

### Required Environment Variables for Cloud Features

| Variable | Required For | Default | Behavior When Missing |
|----------|-------------|---------|----------------------|
| `REACH_CLOUD_ENABLED=true` | All cloud DB features | `false` | Throws `CloudDisabledError` |
| `BILLING_ENABLED=true` | Stripe billing | `false` | Throws `BillingDisabledError` |
| `STRIPE_SECRET_KEY` | Stripe API calls | undefined | Billing disabled |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | undefined | Webhook endpoint fails safely |
| `REDIS_URL` | Redis caching | undefined | Falls back to in-memory store |
| `REACH_CLOUD=1` | Enterprise build override | unset | OSS purity check runs |

### Feature Flag Lifecycle

```text
1. Feature is proposed
2. Feature flag constant is added to env.ts
3. Guard clause is added to all entry points
4. Fallback behavior is implemented
5. CI validates that OSS build passes WITHOUT the flag
6. Cloud tests validate that the feature works WITH the flag
```

---

## 6. Enforcement Mechanisms

### 6.1 Static Analysis Scripts

| Script | What It Checks | Run Command |
|--------|---------------|-------------|
| `scripts/validate-import-boundaries.ts` | Core does not import cloud/billing; CLI does not import web | `npm run validate:boundaries` |
| `scripts/validate-oss-purity.ts` | No cloud SDKs in OSS paths (core, runner, protocol) | `npm run validate:oss-purity` |
| `scripts/verify-no-toxic-deps.mjs` | No toxic/banned dependencies in package.json | `npm run verify:no-toxic-deps` |
| `scripts/anti-sprawl.mjs` | Route count and structure entropy | `npm run anti-sprawl` |

### 6.2 CI Pipeline Gates

| Workflow | Gate | Blocks Merge |
|----------|------|--------------|
| `ci.yml` | Full CI including boundary checks | Yes |
| `readylayer-gate.yml` | ReadyLayer quality suite | Yes |
| `security-audit.yml` | Security scanning | Yes |
| `verify.yml` | Determinism verification | Yes |
| `simplicity.yml` | Simplicity metrics | Yes |

### 6.3 Rust Workspace Guards

The Rust workspace enforces additional safety:
- `unsafe_code = "forbid"` workspace-wide
- `clippy::all = "deny"` and `clippy::pedantic = "deny"`
- Feature flags: `default = ["std"]` with `std` for standard library

### 6.4 Go Module Isolation

Each Go service has its own `go.mod` preventing accidental cross-imports:
- `services/runner/go.mod` — independent module
- `services/capsule-sync/go.mod` — VIOLATION: depends on `services/billing`
- `core/evaluation/go.mod` — independent module
- `internal/packkit/go.mod` — independent module

---

## 7. Violation Resolution Procedures

### When a Violation Is Detected

1. **CI blocks the merge** — The boundary validation script exits non-zero
2. **Developer identifies the offending import** — Check CI logs for the specific file and import
3. **Developer applies one of the resolution patterns below**

### Resolution Pattern A: Extract to Shared Interface

If both modules need common types, extract to a shared interface package:

```text
BEFORE:
  services/capsule-sync → services/billing/tier

AFTER:
  services/capsule-sync → core/features (new shared package)
  services/billing → core/features (new shared package)
```

### Resolution Pattern B: Feature Flag Guard

If cloud code leaks into an OSS path, add a feature flag:

```text
BEFORE:
  Unconditional import of cloud SDK

AFTER:
  if (env.REACH_CLOUD_ENABLED) {
    // dynamic import or guarded call
  }
```

### Resolution Pattern C: Dependency Inversion

If a service needs functionality from another layer, invert the dependency:

```text
BEFORE:
  Runner → Cloud storage (direct import)

AFTER:
  Runner → StorageDriver interface (defined in runner)
  Cloud storage implements StorageDriver (defined in cloud module)
  Wiring at startup via configuration
```

### Current Known Violations

| ID | Description | Status | Fix Plan |
|----|-------------|--------|----------|
| V1 | capsule-sync imports services/billing/tier | OPEN | Extract tier types to core/features or replace with config flags |
| V2 | Compiled .exe binaries in source | OPEN | Add to .gitignore, remove from tracking |
| V3 | Duplicated code in services/billing/internal/billing/plan.go | OPEN | Fix copy-paste corruption or remove since DEPRECATED |
| V4 | Duplicate mobile/ and apps/mobile/ directories | OPEN | Designate canonical location, remove duplicate |

---

## Appendix: Quick Reference Commands

```bash
# Run all boundary validations
npm run validate:boundaries
npm run validate:oss-purity

# Check for toxic dependencies
npm run verify:no-toxic-deps

# Run anti-sprawl audit
npm run anti-sprawl

# Run full CI suite locally
npm run verify:full
```

> **Audit Date**: 2026-02-22
> **Enforcement**: CI via `scripts/validate-import-boundaries.ts` and `scripts/validate-oss-purity.ts`
> **Status**: ACTIVE — Violations block merge

---

## Table of Contents

1. [Boundary Principles](#1-boundary-principles)
2. [Rule Definitions](#2-rule-definitions)
3. [Directory Pattern Matrix](#3-directory-pattern-matrix)
4. [Valid vs Invalid Import Examples](#4-valid-vs-invalid-import-examples)
5. [Feature Flag Requirements](#5-feature-flag-requirements)
6. [Enforcement Mechanisms](#6-enforcement-mechanisms)
7. [Violation Resolution Procedures](#7-violation-resolution-procedures)

---

## 1. Boundary Principles

### P1: Local-First Core
The deterministic engine MUST function entirely offline. No network calls, no cloud SDKs, no external service dependencies in core paths.

### P2: Interface Isolation
Cloud features MUST NEVER be imported directly by OSS core modules. Cloud functionality MUST be accessed via adapter interfaces or behind feature flags.

### P3: Deterministic Heart
The `services/runner` and `crates/engine` are the deterministic heart. External side effects such as network calls, cloud storage, and billing MUST be gated.

### P4: Graceful Degradation
When cloud features are unavailable, the system MUST fall back to OSS-mode behavior. No hard-500 errors for missing cloud credentials.

---

## 2. Rule Definitions

### Rule 1: Core CANNOT Import Cloud Modules

**Scope**: `core/`, `crates/`

**Forbidden imports**:
- Any module from `services/billing/`
- Any module from `apps/arcade/src/lib/cloud-*`
- Any cloud SDK: `stripe`, `auth0`, `@google-cloud`, `aws-sdk`, `azure-sdk`
- Any module from `apps/` web-specific code

**Rationale**: Core modules define the deterministic execution engine. Cloud dependencies would break offline functionality and introduce non-deterministic behavior.

### Rule 2: CLI CANNOT Import Web Modules

**Scope**: `services/runner/cmd/reachctl/`, `services/runner/cmd/reach-eval/`, `services/runner/cmd/reach-serve/`

**Forbidden imports**:
- Any module from `apps/arcade/`
- Any frontend framework: `next`, `react`, `react-dom`
- Any browser APIs or UI libraries

**Rationale**: CLI tools must be lightweight, headless, and runnable in CI environments without browser dependencies.

### Rule 3: Web CANNOT Mutate Engine State Directly

**Scope**: `apps/arcade/`, `extensions/vscode/`

**Forbidden patterns**:
- Direct import of `crates/engine/` Rust source
- Direct import of `core/evaluation/` Go source
- Direct mutation of runner internal state
- Bypassing the API/SDK layer to modify engine internals

**Required**: Web apps MUST interact with the engine via:
- SDK clients: `sdk/ts/`, `sdk/python/`
- Protocol contracts: `protocol/`
- HTTP APIs exposed by `services/runner/`

**Rationale**: The web layer is a presentation concern. Engine state must be managed by the engine, not the UI.

### Rule 4: Cloud Code MUST Be Behind Feature Flags

**Scope**: All cloud-specific code in `apps/arcade/src/lib/`

**Required feature flags**:

| Cloud Feature | Flag | Required |
|---------------|------|----------|
| Cloud DB and auth | `REACH_CLOUD_ENABLED` | Yes |
| Stripe billing | `BILLING_ENABLED` + `STRIPE_SECRET_KEY` | Yes |
| Redis caching | `REDIS_URL` | Optional, graceful fallback |
| GitHub integration | `GITHUB_CLIENT_ID` | Optional |
| SMTP alerting | `SMTP_HOST` | Optional |

**Required behavior when disabled**:
- Throw `CloudDisabledError` or equivalent
- Fall back to local/in-memory alternatives
- Never crash or hard-500

### Rule 5: OSS Paths Forbid Cloud SDKs

**Scope**: `core/`, `services/runner/`, `protocol/`

**Forbidden SDK imports** (enforced by `scripts/validate-oss-purity.ts`):
- `stripe`
- `auth0`
- `@google-cloud`
- `aws-sdk`
- `azure-sdk`

**Override**: Set `REACH_CLOUD=1` environment variable to skip this validation (for enterprise builds only).

### Rule 6: Packages and SDKs CANNOT Import Services

**Scope**: `sdk/`, `protocol/`

**Forbidden imports**:
- Any module from `services/billing/`
- Any module from `services/capsule-sync/`
- Any module from `apps/`

**Rationale**: SDKs and protocol schemas must be standalone, portable, and free of service-layer dependencies.

### Rule 7: Services CANNOT Import Deprecated Modules

**Scope**: All `services/` directories EXCEPT `services/billing/` itself

**Forbidden imports**:
- `services/billing/` (DEPRECATED since 2026-02-18)

**Current violations**:
- `services/capsule-sync/` imports `services/billing/tier` — see [ARCHITECTURE_LOCK.md](ARCHITECTURE_LOCK.md) Violation 1

**Required fix**: Replace billing tier imports with configuration-flag-based feature gating.

---

## 3. Directory Pattern Matrix

This matrix defines which directories can import from which other directories.

| Source (importer) | core/ | crates/ | services/runner/ | services/billing/ | apps/arcade/ cloud | apps/arcade/ oss | sdk/ | protocol/ |
|-------------------|-------|---------|------------------|--------------------|---------------------|-------------------|------|-----------|
| **core/** | Yes | No | No | NO | NO | No | No | Yes |
| **crates/** | No | Yes | No | NO | NO | No | No | No |
| **services/runner/** | No | No | Yes | NO | NO | No | No | Yes |
| **services/capsule-sync/** | No | No | No | VIOLATION | NO | No | No | Yes |
| **apps/arcade/ oss** | No | No | No | No | No | Yes | Yes | Yes |
| **apps/arcade/ cloud** | No | No | No | No | Yes | Yes | Yes | Yes |
| **sdk/** | No | No | No | NO | NO | No | Yes | Yes |
| **protocol/** | No | No | No | NO | NO | No | No | Yes |
| **extensions/vscode/** | No | No | No | No | No | No | Yes | Yes |
| **pack-devkit/** | No | No | No | No | No | No | No | Yes |
| **internal/packkit/** | No | No | No | No | No | No | No | No |

Legend:
- **Yes**: Allowed
- **No**: Not applicable or unnecessary
- **NO**: Explicitly forbidden
- **VIOLATION**: Currently violating this rule

---

## 4. Valid vs Invalid Import Examples

### Rule 1: Core CANNOT Import Cloud

**VALID** - Core importing standard library:
```go
// core/evaluation/engine.go
import (
    "context"
    "encoding/json"
    "time"
)
```

**INVALID** - Core importing billing:
```go
// core/evaluation/engine.go — THIS IS FORBIDDEN
import "reach/services/billing/tier"
```

**INVALID** - Core importing cloud SDK:
```go
// core/evaluation/engine.go — THIS IS FORBIDDEN
import "github.com/stripe/stripe-go/v81"
```

### Rule 2: CLI CANNOT Import Web

**VALID** - CLI importing runner internals:
```go
// services/runner/cmd/reach-serve/main.go
import (
    "reach/services/runner/internal/jobs"
    "reach/services/runner/internal/storage"
)
```

**INVALID** - CLI importing web framework:
```go
// services/runner/cmd/reachctl/main.go — THIS IS FORBIDDEN
import "reach/apps/arcade"
```

### Rule 3: Web uses SDK, not engine directly

**VALID** - Web app using SDK:
```typescript
// apps/arcade/src/lib/some-feature.ts
import { ReachClient } from '@reach/sdk';
```

**VALID** - Web app using protocol types:
```typescript
// apps/arcade/src/components/SomeWidget.tsx
import type { RunEvent } from '@/lib/runtime/types';
```

**INVALID** - Web app importing engine internals:
```typescript
// apps/arcade/src/lib/some-feature.ts — THIS IS FORBIDDEN
import { WorkflowMachine } from '../../../crates/engine/src/state_machine';
```

### Rule 4: Cloud code behind flags

**VALID** - Guarded cloud access:
```typescript
// apps/arcade/src/lib/db/connection.ts
export function getDB(): Database.Database {
  if (!isCloudEnabled()) throw new CloudDisabledError();
  // ...
}
```

**VALID** - Guarded billing:
```typescript
// apps/arcade/src/lib/stripe.ts
export function getStripe(): Stripe {
  if (!isBillingEnabled()) throw new BillingDisabledError();
  // ...
}
```

**INVALID** - Unguarded cloud access:
```typescript
// THIS IS FORBIDDEN — no feature flag check
const db = new Database('reach-cloud.db');
```

### Rule 5: SDK isolation

**VALID** - SDK importing only protocol types:
```typescript
// sdk/ts/src/index.ts
import type { RunEvent } from './types';
```

**INVALID** - SDK importing service:
```typescript
// sdk/ts/src/index.ts — THIS IS FORBIDDEN
import { billing } from '../../services/billing';
```

---

## 5. Feature Flag Requirements

### Required Environment Variables for Cloud Features

| Variable | Required For | Default | Behavior When Missing |
|----------|-------------|---------|----------------------|
| `REACH_CLOUD_ENABLED=true` | All cloud DB features | `false` | Throws `CloudDisabledError` |
| `BILLING_ENABLED=true` | Stripe billing | `false` | Throws `BillingDisabledError` |
| `STRIPE_SECRET_KEY` | Stripe API calls | undefined | Billing disabled |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | undefined | Webhook endpoint fails safely |
| `REDIS_URL` | Redis caching | undefined | Falls back to in-memory store |
| `REACH_CLOUD=1` | Enterprise build override | unset | OSS purity check runs |

### Feature Flag Lifecycle

```text
1. Feature is proposed
2. Feature flag constant is added to env.ts
3. Guard clause is added to all entry points
4. Fallback behavior is implemented
5. CI validates that OSS build passes WITHOUT the flag
6. Cloud tests validate that the feature works WITH the flag
```

---

## 6. Enforcement Mechanisms

### 6.1 Static Analysis Scripts

| Script | What It Checks | Run Command |
|--------|---------------|-------------|
| `scripts/validate-import-boundaries.ts` | Core does not import cloud/billing; CLI does not import web | `npm run validate:boundaries` |
| `scripts/validate-oss-purity.ts` | No cloud SDKs in OSS paths (core, runner, protocol) | `npm run validate:oss-purity` |
| `scripts/verify-no-toxic-deps.mjs` | No toxic/banned dependencies in package.json | `npm run verify:no-toxic-deps` |
| `scripts/anti-sprawl.mjs` | Route count and structure entropy | `npm run anti-sprawl` |

### 6.2 CI Pipeline Gates

| Workflow | Gate | Blocks Merge |
|----------|------|--------------|
| `ci.yml` | Full CI including boundary checks | Yes |
| `readylayer-gate.yml` | ReadyLayer quality suite | Yes |
| `security-audit.yml` | Security scanning | Yes |
| `verify.yml` | Determinism verification | Yes |
| `simplicity.yml` | Simplicity metrics | Yes |

### 6.3 Rust Workspace Guards

The Rust workspace enforces additional safety:
- `unsafe_code = "forbid"` workspace-wide
- `clippy::all = "deny"` and `clippy::pedantic = "deny"`
- Feature flags: `default = ["std"]` with `std` for standard library

### 6.4 Go Module Isolation

Each Go service has its own `go.mod` preventing accidental cross-imports:
- `services/runner/go.mod` — independent module
- `services/capsule-sync/go.mod` — VIOLATION: depends on `services/billing`
- `core/evaluation/go.mod` — independent module
- `internal/packkit/go.mod` — independent module

---

## 7. Violation Resolution Procedures

### When a Violation Is Detected

1. **CI blocks the merge** — The boundary validation script exits non-zero
2. **Developer identifies the offending import** — Check CI logs for the specific file and import
3. **Developer applies one of the resolution patterns below**

### Resolution Pattern A: Extract to Shared Interface

If both modules need common types, extract to a shared interface package:

```text
BEFORE:
  services/capsule-sync → services/billing/tier

AFTER:
  services/capsule-sync → core/features (new shared package)
  services/billing → core/features (new shared package)
```

### Resolution Pattern B: Feature Flag Guard

If cloud code leaks into an OSS path, add a feature flag:

```text
BEFORE:
  Unconditional import of cloud SDK

AFTER:
  if (env.REACH_CLOUD_ENABLED) {
    // dynamic import or guarded call
  }
```

### Resolution Pattern C: Dependency Inversion

If a service needs functionality from another layer, invert the dependency:

```text
BEFORE:
  Runner → Cloud storage (direct import)

AFTER:
  Runner → StorageDriver interface (defined in runner)
  Cloud storage implements StorageDriver (defined in cloud module)
  Wiring at startup via configuration
```

### Current Known Violations

| ID | Description | Status | Fix Plan |
|----|-------------|--------|----------|
| V1 | capsule-sync imports services/billing/tier | OPEN | Extract tier types to core/features or replace with config flags |
| V2 | Compiled .exe binaries in source | OPEN | Add to .gitignore, remove from tracking |
| V3 | Duplicated code in services/billing/internal/billing/plan.go | OPEN | Fix copy-paste corruption or remove since DEPRECATED |
| V4 | Duplicate mobile/ and apps/mobile/ directories | OPEN | Designate canonical location, remove duplicate |

---

## Appendix: Quick Reference Commands

```bash
# Run all boundary validations
npm run validate:boundaries
npm run validate:oss-purity

# Check for toxic dependencies
npm run verify:no-toxic-deps

# Run anti-sprawl audit
npm run anti-sprawl

# Run full CI suite locally
npm run verify:full
```

