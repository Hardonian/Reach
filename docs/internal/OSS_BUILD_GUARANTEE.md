# OSS Build Guarantee

Last Updated: 2026-02-22

## Commitment

Reach is **OSS-first**. The core engine, deterministic runner, CLI, and local storage are fully open-source and run entirely on your hardware without any cloud credentials, proprietary SDKs, or external services.

We formalize this as the **Zero-Cloud Lock Guarantee**:

> Any user cloning this repository can build and run a fully functional Reach installation with only a working Go installation (and optionally Node.js for the web components). No API keys, no cloud account, no network connection required for core operations.

---

## What This Covers

| Component                      | OSS             | Needs Cloud            |
| :----------------------------- | :-------------- | :--------------------- |
| `reachctl` CLI                 | ✅ Full         | None                   |
| Deterministic execution engine | ✅ Full         | None                   |
| Local SQLite storage           | ✅ Full         | None                   |
| Policy evaluation              | ✅ Full         | None                   |
| Replay verification            | ✅ Full         | None                   |
| Export/import capsules         | ✅ Full         | None                   |
| Benchmarking                   | ✅ Full         | None                   |
| Web playground                 | ✅ Full (local) | Cloud features only    |
| Multi-tenant hosting           | ❌              | Requires REACH_CLOUD=1 |
| Enterprise SSO                 | ❌              | Requires REACH_CLOUD=1 |
| Cloud artifact sync            | ❌              | Requires REACH_CLOUD=1 |

---

## What's Never in the OSS Path

The following packages/SDKs are actively blocked from the OSS Core paths and are verified absent by `validate:oss-purity`:

- `stripe` or `@stripe/*` — Billing
- `auth0` or `@auth0/*` — Authentication
- `@google-cloud/*` — Google Cloud storage/services
- `aws-sdk` or `@aws-sdk/*` — AWS services
- `azure*` — Azure services

---

## How It's Enforced

### 1. CI Gate: `validate:oss-purity`

Runs on every PR and blocks merge if any cloud SDK is found in OSS Core paths.

```bash
npm run validate:oss-purity
```

### 2. CI Gate: `verify:oss`

Runs the full OSS quality gate: lint + typecheck + language enforcement + boundary check + OSS purity.

```bash
npm run verify:oss
```

### 3. Import Boundary Check

```bash
npm run validate:boundaries
```

Verifies that no OSS Core component imports from cloud-specific packages.

---

## Cloud Adapter Pattern

When enterprise cloud features are needed, they are implemented via adapter interfaces that live behind the `REACH_CLOUD=1` flag. In OSS mode, all adapters return `RL-4001 CloudNotEnabledError`.

See [`docs/CLOUD_ADAPTER_MODEL.md`](CLOUD_ADAPTER_MODEL.md) for the adapter interface definitions.

---

## Exceptions Handling

If a feature absolutely requires cloud capabilities in its implementation (e.g., decentralized proof storage), it must:

1. Be implemented via a stub/adapter pattern.
2. The OSS version uses a local stub (returns a structured error).
3. The stub must be documented in [`docs/CLOUD_ADAPTER_MODEL.md`](CLOUD_ADAPTER_MODEL.md).
4. The `validate:oss-purity` check must still pass.

No exceptions to the zero-cloud lock without a documented adapter pattern.

---

## Verification

To verify the OSS build guarantee locally:

```bash
# Verify no cloud SDK imports in OSS paths
npm run validate:oss-purity

# Full OSS quality gate
npm run verify:oss

# Build CLI without cloud (should succeed with zero env vars)
cd services/runner && go build ./cmd/reachctl
```

---

## Related Documents

- [`docs/CLOUD_ADAPTER_MODEL.md`](CLOUD_ADAPTER_MODEL.md) — Adapter interfaces for cloud features
- [`docs/IMPORT_RULES.md`](IMPORT_RULES.md) — Import boundary rules
- [`docs/BOUNDARIES.md`](BOUNDARIES.md) — Layering diagram
- [`docs/OSS_FIRST_COMPONENT_MAP.md`](OSS_FIRST_COMPONENT_MAP.md) — Component tier classification
