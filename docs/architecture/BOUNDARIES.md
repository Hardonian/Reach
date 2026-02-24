# Reach Architecture Boundaries

## Layer diagram (text)

1. **Core (`src/core`, `packages/core`, `crates/engine-core`)**
   - Deterministic domain logic, transcript/verification primitives, policy evaluation interfaces.
2. **Storage + Runtime Adapters (`src/go`, `services/*`, `crates/engine`, `crates/ffi`)**
   - Persistence, execution host wiring, FFI boundaries.
3. **Service APIs (`src/lib`, selected `services/*`)**
   - Reusable orchestration services used by CLI/web adapters.
4. **Edge Adapters (`src/cli`, `integrations/*`, `apps/*`)**
   - CLI UX, web/mobile views, external framework integrations.

Dependency flow must stay one-way: `core -> storage/runtime -> service APIs -> edge adapters`.

## Allowed dependencies

- Core may depend on: standard library, schema/types, deterministic utility modules.
- Storage/runtime may depend on core contracts and persistence libraries.
- Service APIs may depend on core + storage contracts (not edge entrypoints).
- Edge adapters may depend on public service/core APIs.

## Forbidden dependencies

- Core importing CLI, display, app, or integration modules.
- Shared service library (`src/lib`) importing CLI modules.
- `services/runner/cmd/reachctl` importing web frameworks (`next`, `react`) or app bundles.

## Boundary violations identified in discovery

1. `src/lib/llm-provider.ts -> src/cli/llm-cli.ts`
   - **Why violation:** shared library depended on CLI adapter types/config path.
   - **Fix pattern:** extracted shared contract (`src/core/llm-types.ts`), both CLI and lib import contract.

## Where adapters live

- CLI adapters: `src/cli/*`
- Framework integrations: `integrations/*`
- App/UI adapters: `apps/*`, `mobile/*`
- Runtime/storage adapters: `src/go/*`, `services/*`, `crates/ffi/*`

Core-facing interfaces must be defined in core/service layers; adapters implement them at the edge.

## How to enforce

- Run `npm run validate:boundaries` locally and in CI.
- Keep import checks path-based with explicit deny-rules for each layer root.
- When a violation appears:
  1. Move shared types/interfaces into core or service contract module.
  2. Keep edge-specific parsing/rendering in adapter package.
  3. Re-run `npm run validate:boundaries` and tests.
