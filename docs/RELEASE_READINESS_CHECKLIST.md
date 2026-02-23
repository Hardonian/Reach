# Reach OSS Release Readiness Checklist

## Version & Stamping ✅

- [x] VERSION file: `0.3.1`
- [x] package.json version: `0.3.1`
- [x] spec version (protocol): `1.0.0`
- [x] `reach version` command added with engineVersion, specVersion, schemaVersion
- [x] CHANGELOG.md present and follows Keep a Changelog format
- [x] CHANGELOG.md entries use semver (0.3.1, 0.3.0, etc.)

## Compatibility Tests ✅

- [x] Golden fixtures for key JSON outputs:
  - [x] `hello-deterministic.fixture.json` (updated to v0.3.1)
  - [x] `capsule-manifest.fixture.json` (new, with engine_version)
  - [x] `decision-output.fixture.json` (new)
  - [x] `version-output.fixture.json` (new)
- [x] Compatibility test: `services/runner/tests/compatibility_test.go`
- [x] Schema updated: `protocol/schemas/capsule-manifest.schema.json` includes engine_version

## Machine Outputs Version Info ✅

- [x] `reach version --json` outputs:
  - engineVersion
  - specVersion
  - schemaVersion
  - gitCommit
  - compatibilityPolicy
  - supportedVersions
- [x] Capsule manifest includes engine_version field
- [x] Provenance command uses engineVersion constant

## Starter Kits ✅

- [x] `reach init` enhanced with templates:
  - `--template=minimal` (default)
  - `--template=governed` (with policy)
  - `--template=full` (with src/)
  - `--name <name>` option
- [x] Example READMEs updated with step-by-step instructions:
  - [x] `examples/packs/minimal-safe/README.md`

## Distribution Polish ✅

- [x] Install docs improved:
  - [x] npm instructions
  - [x] pnpm instructions (new)
  - [x] Docker demo
  - [x] Troubleshooting section
- [x] Checksums/artifact verification notes added to INSTALL.md
- [x] Version output example documented

## Files Changed

### Core Changes
- `services/runner/cmd/reachctl/main.go` - Added version command, updated constants
- `protocol/schemas/capsule-manifest.schema.json` - Added engine_version field

### New Files
- `services/runner/tests/compatibility_test.go` - Compatibility test
- `testdata/fixtures/conformance/capsule-manifest.fixture.json` - Capsule fixture
- `testdata/fixtures/conformance/decision-output.fixture.json` - Decision fixture
- `testdata/fixtures/conformance/version-output.fixture.json` - Version output fixture

### Updated Files
- `testdata/fixtures/conformance/hello-deterministic.fixture.json` - Updated to v0.3.1
- `examples/packs/minimal-safe/README.md` - Enhanced with step-by-step guide
- `docs/INSTALL.md` - Added pnpm, checksums verification, version output example

## Scripts Added

- `reach version` - Print version information with JSON support
- `reach init --name <name> --template <type>` - Initialize new pack with templates

## Verification Commands

When environment has required tools, run:

```bash
# Install dependencies
npm install

# Lint
npm run lint

# Typecheck
npm run typecheck

# Tests
npm run test

# Go vet
cd services/runner && go vet ./...

# Go tests
cd services/runner && go test ./...

# Rust
cargo clippy --workspace
cargo test -p engine-core
```

## Next Steps for Release

1. Ensure CI passes all checks in `.github/workflows/ci.yml`
2. Tag release: `git tag v0.3.1`
3. Create GitHub release with checksums
4. Publish to npm: `npm publish`
5. Push Docker image: `docker push reach/reach:latest`
