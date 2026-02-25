# OSS vs Cloud/Enterprise

Reach ships as an OSS-first platform. The default local developer flow must work with no cloud credentials and with `REACH_CLOUD` unset.

## Feature matrix

| Capability | OSS | Cloud/Enterprise |
| --- | --- | --- |
| Deterministic run, transcript, replay | ✅ Included | ✅ Included |
| Local evidence viewer (`apps/arcade`) | ✅ Included | ✅ Included |
| Policy gates and conformance fixtures | ✅ Included | ✅ Included |
| Multi-tenant account management | ❌ Not in OSS | ✅ Included |
| Hosted key custody/signing orchestration | ❌ Not in OSS | ✅ Included |
| Managed audit stream + long-term archival | ❌ Not in OSS | ✅ Included |

## Boundary rules

- OSS core paths (`core/`, `src/core/`, engine crates, runner OSS paths) must not import cloud billing, identity, or provider SDKs.
- Marketing/public routes must not import authenticated app-only modules.
- Cloud-only behavior must be runtime-gated and default to OSS-safe behavior when enterprise variables are absent.
- CI gates: `npm run validate:boundaries`, `npm run validate:oss-purity`, and `npm run verify:oss`.

## Environment variables

### OSS-safe defaults

- `REACH_CLOUD` (default `0` / unset)
- `NODE_ENV`
- `PORT`

### Enterprise-only (must be absent for OSS verification)

- `REACH_ENTERPRISE`
- `STRIPE_SECRET_KEY`
- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS`

## Run OSS explicitly

Use the OSS verification wrapper, which removes enterprise variables before running the full OSS gates:

```bash
npm run verify:oss
```

You can also run the viewer in OSS mode:

```bash
REACH_CLOUD=0 npm run verify:routes
```
