# Dependency Audit (Security, License, Supply Chain) ## Scope

Repository contains Rust, Go, and Node.js dependency ecosystems across root, services, tools, apps, and extensions.

## Inventory summary - **Rust**: workspace crates with `Cargo.lock` at repository root.
- **Go**: multiple modules under `services/*`, `tools/*`, and `internal/*`.
- **Node**: root package plus `extensions/vscode` and `apps/arcade` packages.

## Commands executed - `npm audit --omit=dev` (repo root)
- `cd extensions/vscode && npm audit --omit=dev`
- `cd services/runner && go mod verify`
- `cd services/runner && go list -m all`
- `cargo audit`

## Vulnerable package scan findings ### Node

- Root audit: **0 vulnerabilities** reported.
- `extensions/vscode` audit: **blocked** by registry advisory endpoint response `403 Forbidden` in this environment.

### Go - `go mod verify` in `services/runner`: **all modules verified**.
- `go list -m all`: blocked from resolving some modules due to `proxy.golang.org ... Forbidden`, so full dependency expansion could not complete in this environment.

### Rust - `cargo audit` command is **not installed** in the environment (`error: no such command: audit`), so Rust advisory DB scan did not run here.

## License conflict check - Top-level repository license: Apache-2.0 (`LICENSE`).
- Rust workspace metadata currently indicates `MIT` (`Cargo.toml [workspace.package].license`), creating policy ambiguity.
- NOTICE file is now present to support attribution packaging hygiene.

## Supply chain risk observations 1. **Polyglot surface area** increases patch and advisory response burden.
2. **Unsigned legacy toggles** (`AllowLegacyUnsigned` and env-driven overrides) can reduce security posture if misconfigured.
3. **No in-repo automated SBOM pipeline artifact** is evident from committed files.

## Recommendations 1. Add CI-enforced per-ecosystem scans:
   - Rust: `cargo-audit` (or equivalent).
   - Go: `govulncheck ./...` for each module.
   - Node: `npm audit`/`npm audit signatures` per package.
2. Publish SBOM and signed provenance for releases.
3. Align manifest license declarations with top-level license policy.
4. Lock production profiles to signed/non-legacy pack paths.

## Dependency risk summary - **Security risk**: **PARTIAL** (root Node clean, but Rust/Go full advisory visibility incomplete in this runtime).
- **License risk**: **PARTIAL** (top-level vs Cargo metadata mismatch).
- **Supply chain risk**: **PARTIAL** (foundational controls exist; provenance and continuous scanning should be strengthened).
