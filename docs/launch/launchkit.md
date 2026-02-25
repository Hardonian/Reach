# Launch Kit

## Install Commands

### Linux / macOS

```bash
curl -fsSL https://github.com/reach/reach/releases/latest/download/install.sh | bash
reach version
reach doctor
```

### Windows (PowerShell)

```powershell
irm https://github.com/reach/reach/releases/latest/download/install.ps1 | iex
reachctl.exe version
reachctl.exe doctor
```

### Source Build

```bash
git clone https://github.com/reach/reach.git
cd reach
npm install
make build
./reach version
./reach doctor
```

## First Run Path

```bash
reach demo
reach capsule verify data/capsules/<run-id>.capsule.json
reach capsule replay data/capsules/<run-id>.capsule.json
```

## Docs Map

- Product docs: https://reach-cli.com
- Install guide: `docs/INSTALL.md`
- CLI reference: `docs/cli.md`
- Threat model: `docs/threat-model.md`
- Troubleshooting: `docs/troubleshooting/common-failures.md`

## Security and Reporting

- Security policy: `SECURITY.md`
- Private disclosure: `security@reach.dev`
- Redacted diagnostics: `reach bugreport`
- Security issue template: `.github/ISSUE_TEMPLATE/security_issue.yml`

## Pack Publishing Workflow

1. Create or update pack in `packs/` or `examples/packs/`.
2. Validate locally:
   - `reach pack lint <path>`
   - `reach pack doctor <path>`
3. Dry-run publish metadata:
   - `reach pack publish <path> --dry-run`
4. Open PR with pack + docs updates.

## Release Process

1. Run launch gates locally:
   - `npm run verify`
   - `npm run verify:sites`
   - `npm run demo:smoke`
2. Tag release (`vX.Y.Z`) to trigger `.github/workflows/release.yml`.
3. Verify release assets:
   - platform binaries
   - `reach`
   - `install.sh`
   - `install.ps1`
   - `SHA256SUMS`
4. Smoke install from published release and run:
   - `reach version`
   - `reach doctor`
   - `reach demo`
