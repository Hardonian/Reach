# Changelog Guide

How to maintain the changelog for Reach releases.

---

## Changelog Location

- **File**: `CHANGELOG.md` (repository root)
- **Format**: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
- **Versioning**: [SemVer](https://semver.org/)

---

## Changelog Format

```markdown
# Changelog

All notable changes to Reach are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New features

### Changed

- Changes to existing functionality

### Deprecated

- Soon-to-be removed features

### Removed

- Removed features

### Fixed

- Bug fixes

### Security

- Security fixes

## [X.Y.Z] - YYYY-MM-DD

### Added

- Feature description (#PR)

### Fixed

- Bug fix description (#issue)
```

---

## Entry Categories

| Category     | Use For                            | Example                                    |
| ------------ | ---------------------------------- | ------------------------------------------ |
| `Added`      | New features                       | Added `--json` flag to export command      |
| `Changed`    | Modifications to existing features | Improved replay performance by 30%         |
| `Deprecated` | Features marked for removal        | Deprecated old policy syntax               |
| `Removed`    | Deleted features                   | Removed v1 replay format support           |
| `Fixed`      | Bug fixes                          | Fixed race condition in event ordering     |
| `Security`   | Vulnerability fixes                | Fixed potential injection in policy parser |

---

## Writing Good Entries

### Do

- Write for users, not developers
- Include issue/PR references
- Explain the impact, not just the change
- Use present tense

```markdown
### Fixed

- Replay now correctly handles out-of-order events. Previously, certain
  event sequences could cause divergence. (#1234)
```

### Don't

- Use internal jargon
- Reference internal systems without context
- Include trivial changes (typos, formatting)

```markdown
<!-- Bad -->

### Fixed

- Fixed bug in RL-2001 handler
- Updated config.go
```

---

## During Development

1. **Add entries as you go** — Don't wait for release
2. **Put entries under [Unreleased]** — They'll be moved during release
3. **Reference PRs/issues** — Link to context

```markdown
## [Unreleased]

### Added

- New `--dry-run` flag for `reach presets apply`. Preview changes
  without applying them. (#567)
```

---

## Release Process

### Step 1: Move Unreleased

Change:

```markdown
## [Unreleased]
```

To:

```markdown
## [0.3.1] - 2026-02-23
```

### Step 2: Add Links

At bottom of file:

```markdown
[Unreleased]: https://github.com/reach/reach/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/reach/reach/compare/v0.3.0...v0.3.1
```

### Step 3: Create New Unreleased Section

Add empty section for next release:

```markdown
## [Unreleased]

### Added

### Changed

### Fixed
```

---

## Version Bump Mapping

| Change Type         | Version Bump            | Example               |
| ------------------- | ----------------------- | --------------------- |
| Breaking API change | MAJOR (X.y.z → X+1.0.0) | Replay format v1 → v2 |
| New feature         | MINOR (x.Y.z → x.Y+1.0) | Added preset support  |
| Bug fix             | PATCH (x.y.Z → x.y.Z+1) | Fixed race condition  |

---

## Special Sections

### Migration Guides

For breaking changes, add a migration subsection:

```markdown
## [1.0.0] - 2026-06-01

### Changed

- **BREAKING**: New policy schema required. See migration guide.

#### Migration

1. Run `reach migrate policies`
2. Update custom policies to v2 schema
3. Verify with `reach validate-policy`
```

### Security Advisories

Security fixes get prominent placement:

```markdown
## [0.3.1] - 2026-02-23

### Security

- **CVE-2026-XXXX**: Fixed potential policy bypass. All users
  should upgrade immediately.

### Fixed

- Other bug fixes...
```

---

## Automation

### Generate from Commits

Optional script to draft from conventional commits:

```bash
# List commits since last tag
git log v0.3.0..HEAD --oneline --no-decorate

# Categorize by conventional commit prefix
# feat: → Added
# fix: → Fixed
# docs: → (skip or Changed)
# refactor: → Changed
# perf: → Changed (performance)
```

### CI Check

Validate changelog is updated:

```yaml
- name: Check CHANGELOG
  run: |
    git diff --name-only origin/main | grep -q CHANGELOG.md || \
      (echo "CHANGELOG.md not updated" && exit 1)
```

---

## Example Full Entry

```markdown
## [0.3.1] - 2026-02-23

### Added

- `reach presets apply --dry-run` to preview configuration changes
  without applying them. (#890)
- Support for ARM64 Linux binaries. (#892)

### Changed

- Improved replay verification speed by 40% through optimized
  event batching. (#891)
- Updated default policy bundle to v1.2. (#893)

### Fixed

- Fixed potential deadlock during concurrent policy evaluation. (#894)
- Corrected error message for missing policy files. (#895)

### Security

- Updated dependency `github.com/foo/bar` to v2.3.1 to address
  CVE-2026-1234. (#896)

[Unreleased]: https://github.com/reach/reach/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/reach/reach/compare/v0.3.0...v0.3.1
```

---

## See Also

- [Release Template](./release-template.md) — GitHub release notes format
- [v0.1 Announcement](./v0.1-announcement.md) — Example announcement
- [Keep a Changelog](https://keepachangelog.com/) — Full specification
- [Semantic Versioning](https://semver.org/) — Version numbering
