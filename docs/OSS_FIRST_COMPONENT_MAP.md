# OSS First Component Map

| Component | Purpose | Dependencies | Tier | Coupling Notes |
|-----------|---------|--------------|------|----------------|
| `services/runner` | Core execution engine, deterministic gates, replay | Go, SQLite (local) | OSS | Foundation of the protocol. |
| `reachctl` | Primary CLI for interacting with Reach | `services/runner` | OSS | Directly invokes engine logic. |
| `sdk/ts` | TypeScript SDK for building and interacting with Reach | Node.js | OSS | Essential for developer experience. |
| `apps/arcade` | Web playground and demo interface | Next.js, SQLite, Stripe, Redis | Hybrid | Currently Has Stripe/Redis deps (Cloud). Needs "OSS Mode" stubbing. |
| `protocol/` | Schema definitions and protocol specs | - | OSS | Source of truth for all implementations. |
| `services/billing`| Enterprise billing and subscription management | Stripe, DB | Cloud | High entropy. To be flagged off in OSS build. |
| `services/session-hub`| Remote session persistence and sharing | Redis, Cloud DB | Cloud | Local fallback for OSS. |
| `services/capsule-sync`| Cloud-based artifact synchronization | S3/GCS | Cloud | Local filesystem storage for OSS. |
| `internal/packkit`| Pack development and validation toolkit | Go | OSS | Critical for plugin/pack ecosystem. |
| `crates/` | High-performance Rust components | Rust | OSS | Used by engine for specialized tasks. |

## Legend
- **OSS**: Core open source components. Success by default.
- **Cloud**: Future enterprise features. Stubbed/Flagged off in OSS.
- **Hybrid**: Parts of the component are OSS, parts depend on cloud infrastructure.
