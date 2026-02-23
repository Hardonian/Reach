# GitHub Release Notes Template

Use this template for all Reach releases.

---

## Release Title Format

```
Reach vX.Y.Z — [Theme/Highlight]
```

Example: `Reach v0.3.1 — Deterministic Replay Improvements`

---

## Release Notes Structure

````markdown
## 🎯 Highlights

- Major feature 1: Brief description
- Major feature 2: Brief description

---

## ✨ New Features

### Feature Category

- **Feature name**: Description. ([docs](link))

---

## 🔧 Improvements

- **Component**: What improved and why it matters.

---

## 🐛 Bug Fixes

- **Issue description**: What was fixed. (#issue-number)

---

## 📊 Performance

| Metric       | Before | After | Change |
| ------------ | ------ | ----- | ------ |
| Replay speed | 100ms  | 75ms  | -25%   |
| Memory usage | 50MB   | 40MB  | -20%   |

---

## 🆕 CLI Commands

```bash
# New command example
reach new-command --flag value
```
````

---

## 📚 Documentation

- New guide: [Title](link)
- Updated: [Section](link)

---

## ⚠️ Breaking Changes

None.

_or_

- **Change**: Description. [Migration guide](link)

---

## 🔐 Security

- CVE-ID: Description and fix summary.

_or_

No security changes.

---

## 📦 Assets

| Asset                            | Description           |
| -------------------------------- | --------------------- |
| reach-vX.Y.Z-linux-amd64.tar.gz  | Linux x86_64 binary   |
| reach-vX.Y.Z-darwin-amd64.tar.gz | macOS x86_64 binary   |
| reach-vX.Y.Z-darwin-arm64.tar.gz | macOS Apple Silicon   |
| reach-vX.Y.Z-windows-amd64.zip   | Windows x86_64 binary |
| Source code (zip)                | Source archive        |
| Source code (tar.gz)             | Source archive        |

---

## 🙏 Contributors

Thanks to @username1, @username2, @username3 for their contributions.

---

## 📋 Verification

Verify your download:

```bash
# Linux/macOS
sha256sum -c reach-vX.Y.Z-linux-amd64.tar.gz.sha256

# Or check signature
cosign verify --key release.pub reach-vX.Y.Z-linux-amd64.tar.gz
```

---

**Full Changelog**: https://github.com/reach/reach/compare/vX.Y.Z-1...vX.Y.Z

```

---

## Checklist

Before publishing:

- [ ] Version bumped in `VERSION`
- [ ] CHANGELOG.md updated
- [ ] All tests passing (`pnpm run verify:full`)
- [ ] Binaries built for all platforms
- [ ] Checksums generated
- [ ] Signatures created (if using cosign)
- [ ] Docker images published
- [ ] Documentation updated
- [ ] Migration guide written (if breaking changes)

---

## Version-Specific Notes

### v0.3.x (Beta)

- Emphasize beta status
- Note known limitations
- Highlight stability improvements

### v0.4.x (Beta)

- Focus on API stabilization
- Migration path from v0.3.x

### v1.0.0 (Stable)

- Remove beta warnings
- Emphasize production readiness
- Long-term support commitment
```
