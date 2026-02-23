# Complexity Reduction Report

This report identifies structural redundancies and complexity hotspots in the Reach repository, following the Antigravity principles.

## 1. Hotspots

### CLI Monolith (`services/runner/cmd/reachctl/main.go`)

- **Size**: 3,773 lines.
- **Issue**: Most CLI commands are implemented directly in `main.go`, including business logic for capsules, proofs, and federation.
- **Recommendation**: Decouple command handlers into subcommands in `cmd/reachctl/commands/`.

### Duplicate Models

- **Issue**: `runRecord` and `capsuleFile` are redefined in `main.go` for JSON unmarshaling, duplicating definitions in `internal/determinism` and `internal/poee`.
- **Recommendation**: Centralize execution models in `core/models` or use internal shared copies.

### Adapter Overlap

- **Issue**: Multiple ways to load "runs" exist across `reachctl` and `runner` service.
- **Recommendation**: Unify the `RunProvider` interface.

## 2. Safe Redundancies Removed

- [✓] Removed duplicate base64 import in `main.go`.
- [✓] Standardized `ReachError` to include suggestion/determinism fields, replacing ad-hoc error formatting in several internal packages.
- [✓] Unified `stableHash` calls in `reachctl` to use the centralized `determinism.Hash` package.

## 3. Verified-Safe Cleanups

- [✓] Removed unused test variables in `determinism/stress_test.go`.
- [✓] Optimized `runPlayground` to use a single deterministic configuration object rather than multiple ad-hoc maps.

## 4. Circular Dependencies

- [✓] `madge` scan confirmed zero circular dependencies in TS/JS components.
- [✓] Go subpackages in `services/runner/internal` follow a strict tree structure; no circularity detected.
