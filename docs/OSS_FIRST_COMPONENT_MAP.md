# OSS-First Component Map

Last Updated: 2026-02-22

## Purpose

This document is the authoritative mapping of all Reach components against their OSS/Cloud classification, dependencies, and coupling points. It is used by CI governance to enforce boundary rules, and by contributors to understand which paths are safe for OSS modification.

---

## Component Table

| Component | Purpose | Key Dependencies | Tier | Coupling Notes |
| :--- | :--- | :--- | :--- | :--- |
| `services/runner` | Deterministic execution engine, policy gates, replay, local storage | Go, SQLite | **OSS Core** | Foundation of the Reach protocol. All execution paths must remain cloud-free in OSS mode. |
| `services/runner/cmd/reachctl` | Primary CLI for all Reach operations | `services/runner` internal packages | **OSS Core** | Must never import `apps/arcade` or any frontend packages. |
| `crates/engine` | High-performance Rust deterministic execution core | Rust, serde, serde_json | **OSS Core** | Pure logic; must remain FFI-compatible with the Go runner. |
| `crates/engine-core` | Rust invariant enforcement, replay verification, chaos tests | Rust, anyhow | **OSS Core** | All determinism invariants live here. |
| `crates/ffi/uniffi` | UniFFI bridge between Rust engine and mobile SDKs | Rust uniffi | **OSS Core** | Used by iOS/Android SDKs. |
| `crates/ffi/c_abi` | C ABI bridge for embedding Rust engine | Rust | **OSS Core** | Low-level FFI; no cloud deps allowed. |
| `sdk/ts` | TypeScript SDK for building Reach integrations | Node.js, TypeScript | **OSS Core** | Essential developer-facing library. Must not require cloud credentials. |
| `protocol/` | Wire schema definitions (JSON Schema, NDJSON) | None | **OSS Core** | Source of truth for all protocol implementations. Must be versioned. |
| `apps/arcade` | Web playground, documentation, and demo interface | Next.js, SQLite | **Hybrid** | The demo path must work without cloud. Stripe/Redis are stubbed in OSS mode via `REACH_CLOUD` flag. |
| `extensions/vscode` | VS Code integration for local development | VS Code API, TypeScript | **OSS Core** | Must not require any cloud credentials for basic operation. |
| `pack-devkit/harness` | Pack development and validation toolkit | Go | **OSS Core** | Critical for the plugin/pack ecosystem. |
| `services/billing` | Enterprise billing and subscription management | Stripe, Go | **Cloud Only** | High entropy. Fully flagged off in OSS build. Never imported by OSS paths. |
| `services/session-hub` | Remote session persistence and sharing | Redis, Cloud DB | **Cloud Only** | Local fallback (in-memory/SQLite) for OSS. Adapter interface required. |
| `services/capsule-sync` | Cloud-based artifact synchronization | S3/GCS | **Cloud Only** | Local filesystem storage is the OSS equivalent. |
| `internal/packkit` | Pack development toolkit (internal) | Go | **OSS Core** | Used by pack development tooling. |
| `core/federation` | Federated execution contract definitions | Go | **OSS Core** | Protocol contracts only; no cloud-specific logic. |
| `sdk/python` | Python SDK for Reach integrations | Python, httpx | **OSS Core** | Must work without cloud credentials. |
| `apps/mobile/ios` | iOS mobile client (Swift) | Swift, UniFfi | **OSS Core** | Mobile-specific Reach shell. |
| `apps/mobile/android` | Android mobile client | Kotlin/Gradle | **OSS Core** | Mobile-specific Reach shell. |

---

## Tier Definitions

| Tier | Definition | `REACH_CLOUD` Requirement |
| :--- | :--- | :--- |
| **OSS Core** | Ships in the default open-source build. Must function with zero external credentials. | Not required (must work when unset) |
| **Hybrid** | Primarily OSS with optional cloud features behind feature flags. | Optional (`=1` enables cloud features) |
| **Cloud Only** | Enterprise-only. Stubbed in OSS mode, fully activated with cloud credentials. | Required (`=1`) |

---

## Known Coupling Points (Action Required)

| Coupling | Location | Status | Remediation |
| :--- | :--- | :--- | :--- |
| Stripe import in arcade | `apps/arcade` | ⚠️ Partially isolated | Ensure behind `REACH_CLOUD=1` dynamic import |
| Redis session keys in session-hub | `services/session-hub` | ⚠️ Needs adapter | Implement `SessionProvider` interface with in-memory OSS stub |
| Direct billing check in runner | `services/runner/internal/billing` | ✅ Stubbed | Uses no-op stub when `REACH_CLOUD` unset |

---

## Import Boundary Summary

See [`docs/IMPORT_RULES.md`](IMPORT_RULES.md) for machine-enforced rules.

Quick reference:
- `core/` → may NOT import from `cloud/`, `services/billing`, `stripe`, `auth0`
- `services/runner/cmd/reachctl` → may NOT import from `apps/arcade`, `next`, `react`
- `apps/*` → must NOT directly mutate execution state (use protocol interfaces)
- Any `OSS Core` component → must NOT import from any `Cloud Only` component

---

## Verification

```bash
# Check OSS purity (no cloud SDK leakage)
npm run validate:oss-purity

# Check import boundaries
npm run validate:boundaries

# Full OSS quality gate
npm run verify:oss
```
