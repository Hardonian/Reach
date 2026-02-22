# System Boundaries & Layering

## Architectural Principles
1. **Local-First**: The core engine must function entirely offline.
2. **Interface Isolation**: Cloud features must never be imported directly by OSS core. They must be accessed via Interfaces/Adapters.
3. **Deterministic Core**: The `services/runner` is the deterministic heart. External side effects (Network, Cloud Storage) must be gated.

## Layering Diagram (Text)

```text
+---------------------------------------+
|          UI Layer (Arcade/CLI)        |
|   (Stubbed Cloud UI / Local Only Mode)|
+---------------------------------------+
                   |
                   v
+---------------------------------------+
|        SDK / Adapter Interfaces       |
| (StorageDriver, AuthProvider, etc.)   |
+---------------------------------------+
         /                   \
        v                     v
+-----------------+     +-------------------+
|  Local Impl     |     |   Cloud Impl      |
| (SQLite/FS)     |     | (Postgres/Redis)  |
| [OSS DEFAULT]   |     | [FEATURE FLAG]    |
+-----------------+     +-------------------+
        \                     /
         v                   v
+---------------------------------------+
|           Deterministic Engine        |
|      (Protocol V1 / Determinism)      |
+---------------------------------------+
```

## Import Rules
- `packages/*` and `sdk/*` must NOT import from `services/billing` or `services/capsule-sync`.
- `services/runner` must remain agnostic of the storage backend (use `StorageDriver`).
- `apps/arcade` must use dynamic imports or feature flags for cloud-specific SDKs (like Stripe).

## Terminology
- **OSS Mode**: Default state. No external credentials required.
- **Enterprise Mode**: Enabled via `REACH_CLOUD=1`. Enables hosted features.
