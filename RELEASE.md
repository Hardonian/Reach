# Release Process

This document describes the process for preparing and executing a Reach release.

## Release Checklist

### 1. Verification

- [ ] Run OSS gate: `npm run verify:oss`.
- [ ] Run language/runtime checks: `cargo clippy --workspace`, `cargo test -p engine-core`, `go vet ./...`, `go test ./...`.
- [ ] Build both site modes: `(cd apps/arcade && npm run build:oss && npm run build:enterprise)`.
- [ ] Run demo smoke path: `reach demo`.
- [ ] Verify `reach doctor` passes on clean install.

### 2. Preparation

- [ ] Update `VERSION` file.
- [ ] Update `CHANGELOG.md` with the new version and notes.
- [ ] Ensure all dependencies are pinned/locked.

### 3. Execution

- [ ] Tag the release: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
- [ ] Push tags: `git push origin --tags`.
- [ ] Monitor `.github/workflows/release.yml` for artifacts on Linux/macOS/Windows (amd64/arm64).
- [ ] Confirm `SHA256SUMS` was generated and uploaded with the release assets.
- [ ] Confirm SBOMs (`sbom-go.cdx.json`, `sbom-node.cdx.json`) were published.

### 4. Post-Release

- [ ] Validate fresh install from release scripts (`scripts/install.sh` and `scripts/install.ps1`).
- [ ] Validate `reach version` and `reach doctor` in a clean shell.
- [ ] Announce release and include install + verification commands.

## Versioning Strategy

Reach follows [Semantic Versioning 2.0.0](https://semver.org/).

- **Major**: Breaking protocol or engine changes.
- **Minor**: New capabilities, major features, or significant optimizations.
- **Patch**: Bug fixes and documentation updates.
