# System Boundaries & Layering

Last Updated: 2026-02-22

## Architectural Principles

1. **Local-First**: The core engine must function entirely offline with zero external credentials.
2. **Interface Isolation**: Cloud features must never be imported directly by OSS core. They must be accessed via defined Interfaces/Adapters.
3. **Deterministic Core**: `services/runner` is the deterministic heart. External side effects (network, cloud storage) must be explicitly gated behind `REACH_CLOUD=1`.
4. **Zero Entropy Leakage**: No randomness, wall-clock timestamps, or unordered map iteration may reach the execution fingerprint path.
5. **Fail Gracefully**: All user-facing code paths must return structured `ReachError` responses. No uncaught panics, no HTTP 500 responses without a body.

---

## Layering Diagram

```
+─────────────────────────────────────────────────────────────┐
│                   Presentation Layer                          │
│   apps/arcade (Web)  ·  extensions/vscode  ·  reachctl (CLI) │
│            (stubbed cloud UI / local-only mode)               │
+───────────────────────────┬─────────────────────────────────-+
                            │
                            ▼
+─────────────────────────────────────────────────────────────+
│              SDK / Adapter Interface Layer                    │
│   sdk/ts  ·  sdk/python  ·  StorageDriver  ·  AuthProvider   │
│   BillingProvider (stub)  ·  ArtifactStore  ·  TenantResolver│
+──────────────────┬──────────────────────────┬───────────────-+
                   │                          │
          OSS Default                   Cloud Impl
                   │                          │
                   ▼                          ▼
+-─────────────────────────+   +──────────────────────────────+
│    Local Implementation  │   │     Cloud Implementation     │
│  SqliteDriver / FS store │   │  Postgres / Redis / S3       │
│  [OSS DEFAULT: ALWAYS]   │   │  [ONLY when REACH_CLOUD=1]   │
+──────────────────────────+   +──────────────────────────────+
                   \                          /
                    ──────────────────────────
                                │
                                ▼
+─────────────────────────────────────────────────────────────+
│              Deterministic Engine Layer                       │
│   services/runner  ·  crates/engine  ·  crates/engine-core   │
│    Protocol V1  ·  Policy Evaluation  ·  Replay Verification │
+─────────────────────────────────────────────────────────────+
```

---

## Import Rules (Enforced by CI)

Violations are blocked by `npm run validate:boundaries`. See [`docs/IMPORT_RULES.md`](IMPORT_RULES.md) for full list.

### Must-Never Imports

| Source Path | Forbidden Import | Reason |
| :--- | :--- | :--- |
| `core/` | `cloud/`, `services/billing`, `stripe`, `auth0` | Core must be cloud-free |
| `services/runner/cmd/reachctl` | `apps/arcade`, `next`, `react` | CLI must not depend on web |
| Any `OSS Core` component | Cloud SDK packages | OSS purity guarantee |
| `protocol/` | Any runtime dependency | Protocol is schema-only |

### Required Patterns

| Component | Must Access Via | Reason |
| :--- | :--- | :--- |
| Storage | `StorageDriver` interface | Backend-agnostic |
| Auth (if needed) | `AuthProvider` interface | OSS stub by default |
| Billing | `BillingProvider` interface (stub) | Returns 402 in OSS mode |
| Artifact sync | `ArtifactStore` interface | Local FS in OSS mode |

---

## Feature Flag Rules

| Flag | Behavior | Used For |
| :--- | :--- | :--- |
| `REACH_CLOUD` unset or `=0` | OSS mode (default) | Local execution, SQLite storage |
| `REACH_CLOUD=1` | Cloud mode | Enables enterprise adapter implementations |

**Critical rule**: Any code reading `REACH_CLOUD=1` must be in a `Cloud Only` component (per [`OSS_FIRST_COMPONENT_MAP.md`](OSS_FIRST_COMPONENT_MAP.md)). OSS Core components must never check this flag.

---

## Terminology

- **OSS Mode**: Default state. Zero external credentials required.
- **Enterprise Mode**: Enabled via `REACH_CLOUD=1`. Activates hosted features via adapter interfaces.
- **Adapter**: An interface implementation that bridges the OSS core to a cloud backend.
- **Stub**: An adapter implementation that returns a safe error (`RL-4001`) instead of calling cloud APIs.

---

## Verification

```bash
# Enforce import boundary rules
npm run validate:boundaries

# Verify no cloud SDK imports in OSS paths
npm run validate:oss-purity

# Complete OSS quality gate
npm run verify:oss
```
