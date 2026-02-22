# OSS First Pivot Plan

## Objective
Transition Reach to a local-first, OSS-default architecture without losing future cloud capabilities.

## Phase 0: Foundation (Current)
- [x] Audit repo and map components.
- [x] Define boundaries and layering.
- [ ] Establish regression armor (verify scripts, smoke tests).

## Phase 1: Core Engine Decoupling
- [ ] Implement `StorageDriver` interface in Go engine.
- [ ] Default all storage to `~/.reach/data` (SQLite/Filesystem).
- [ ] Stub out `billing` and `auth` dependencies with local-noop implementations.

## Phase 2: CLI Hardening
- [ ] Ensure `reachctl` works without any cloud configuration.
- [ ] Add `reachctl doctor` to verify local environment health.
- [ ] Support `--json` output for all major commands.

## Phase 3: Web Demo (Arcade) Refactor
- [ ] Detect "No Cloud" environment and show "Local Only" banner.
- [ ] Stub Stripe/Redis paths when local.
- [ ] Ensure the "30-second demo" run works without external infrastructure.

## Phase 4: CI/DX Polish
- [ ] Update `README.md` for OSS-first quickstart.
- [ ] Add `verify:oss` to CI to prevent cloud-leakage regressions.
- [ ] Enforce canonical terminology.

## Acceptance Criteria
- `npm run verify:oss` passes without any cloud keys.
- `reachctl run` executes a test pack successfully on a clean machine.
- `apps/arcade` builds and runs without a running Redis/Postgres.
