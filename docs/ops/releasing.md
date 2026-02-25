# Release Operations

This repo uses SemVer with `VERSION` as the source of truth and `CHANGELOG.md` as the release-note source.

## Workflow

1. Update `VERSION`.
2. Move relevant `Unreleased` entries in `CHANGELOG.md` into a versioned section.
3. Run release dry-run checks:

```bash
npm run verify:release
```

4. Tag and push:

```bash
git tag v$(cat VERSION)
git push origin v$(cat VERSION)
```

5. GitHub Actions `release.yml` builds cross-platform binaries, generates `SHA256SUMS`, `artifact-manifest.json`, and publishes release notes derived from changelog content.

## Determinism / Reliability Controls

- Release workflow uses `concurrency` to prevent overlapping release jobs for the same ref.
- Checksums are generated with stable ordering (`LC_ALL=C` + sorted file list).
- Artifacts are retained for post-release inspection.
- Publish verification retries remote asset checks to reduce transient network flakiness.

## Human Checklist

- `CHANGELOG.md` has an `Unreleased` section and complete notes for target version.
- `VERSION` is SemVer and matches tag.
- `npm run verify:release` passes.
- `npm run verify:conformance` passes.
- `npm run verify:vercel` passes.
