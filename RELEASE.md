# Release Process

This document describes the process for preparing and executing a Reach release.

## Release Checklist

### 1. Verification

- [ ] Run `npm run verify:full` (Lints, Types, Tests, Drift).
- [ ] Verify `reach doctor` passes on clean install.
- [ ] Check smoke tests for the Arcade (Docs/FAQ/Support).

### 2. Preparation

- [ ] Update `VERSION` file.
- [ ] Update `CHANGELOG.md` with the new version and notes.
- [ ] Ensure all dependencies are pinned/locked.

### 3. Execution

- [ ] Tag the release: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
- [ ] Push tags: `git push origin --tags`.
- [ ] Monitor CI for successful artifact generation (Docker, binaries).

### 4. Post-Release

- [ ] Verify the live `/status` page reflects any maintenance windows.
- [ ] Announce in Discord/GitHub Discussions.

## Versioning Strategy

Reach follows [Semantic Versioning 2.0.0](https://semver.org/).

- **Major**: Breaking protocol or engine changes.
- **Minor**: New capabilities, major features, or significant optimizations.
- **Patch**: Bug fixes and documentation updates.
