# Architectural Findings

## Structural Map

1. **CLI (`src/cli`)**: Contains all command-line operations (over 40 distinct CLI entrypoints), mixed with some operational logic.
2. **Core Engine (`src/core`, `crates/engine`)**: Contains the primary deterministic engine and WASM shims (`zeolite-core`, `shim`).
3. **Determinism (`src/determinism`)**: Contains determinism utilities (hashing, seeded randomness), but similar utility patterns repeat elsewhere.
4. **Web (`apps/arcade`)**: Contains the Next.js application, UI components, and API routes.
5. **Storage (`apps/arcade/src/lib/db`)**: SQLite-based local schemas and operations, tightly coupled to the web application.
6. **Contracts/SDK (`sdk`, `contracts`)**: Intended to be the canonical source of types, but many types are deeply embedded instead in `apps/arcade/src/lib` and `src/core`.

## Conceptual Duplication & Overlapping Responsibilities

1. **Engine Logic Leakage**: `apps/arcade/src/lib` contains substantial engine logic that violates single-responsibility boundaries (`diff-engine.ts`, `gate-engine.ts`, `scoring-engine.ts`, `plugin-system.ts`, `simulation-runner.ts`, `telemetry-engine.ts`). These are decision domains and should not be coupled to the Next.js React codebase.
2. **Type/Contract Duplication**: `apps/arcade/src/lib/db/types.ts` defines core domain types (Gate, Workflow, Decision, etc.) that likely mirror those in the core engine or SDK.
3. **Storage Boundary Violations**: Direct database mutation/schema logic resides inside the web application (`apps/arcade/src/lib/db`) instead of a centralized, isolated storage layer.
4. **CLI Scatter**: `src/cli` acts as a dump for all command scripts instead of a structured router, risking logic bleeding across boundary lines.
5. **Determinism Logic**: `src/determinism` implements basic determinism primitives, but Next.js code implements its own similar primitives (e.g. nested in `apps/arcade/src/lib/decision/engineAdapter.ts` if true, or within the diff engines).

## Action Plan (Phase 1-4)

- **Domain Realignment**: We will treat `src/core` (or a dedicated `src/engine`) as the sole canonical logic engine. `apps/arcade/src/lib` engine implementations will either be moved to `src/core` or adapted to be pure SDK clients.
- **Concept Compression**: Unify types from `apps/arcade/src/lib/db/types.ts` into `src/contracts` or `src/core/types` and eliminate duplicate utility implementations.
- **Boundary Hardening**: Update `apps/arcade` to rely on the centralized types/engine tools instead of redefining them locally.
