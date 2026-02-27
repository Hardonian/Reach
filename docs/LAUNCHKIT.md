# Reach OSS LaunchKit

## Install

### macOS/Linux
```bash
curl -fsSL https://raw.githubusercontent.com/reach/reach/main/scripts/install.sh | bash
export PATH="$HOME/.reach/bin:$PATH"
reach version
reach doctor
```

### Windows PowerShell
```powershell
iwr https://raw.githubusercontent.com/reach/reach/main/scripts/install.ps1 -UseBasicParsing | iex
$env:Path = "$HOME/.reach/bin;" + $env:Path
reach version
reach doctor
```

## First-run path (one command)

```bash
reach demo
```

This executes a sample run, creates a capsule, verifies the capsule fingerprint, and replays it.

## Docs map

- Product overview: `README.md`
- Contribution flow: `CONTRIBUTING.md`
- Security policy + disclosure: `SECURITY.md`
- Release process: `RELEASE.md`
- OSS docs tree: `docs/`

## Security / reporting

- Private disclosure: `security@reach.dev`
- Public issue templates: `.github/ISSUE_TEMPLATE/`
- Bug bundle helper: `reach bugreport`

## Pack publishing workflow

1. Validate pack locally: `reach pack add <path-or-archive>` and `reach packs lint <path>`.
2. Verify OSS gates: `npm run verify:oss`.
3. Add/update docs in `docs/packs/`.
4. Publish through marketplace workflow (`.github/workflows/marketplace-publish.yml`).

## Release process

1. Run `npm run verify:oss` + Rust + Go test gates.
2. Tag `vX.Y.Z` and push tag.
3. Confirm `.github/workflows/release.yml` produced linux/macos/windows artifacts plus `SHA256SUMS`.
4. Validate fresh install using `scripts/install.sh` and `scripts/install.ps1`.
