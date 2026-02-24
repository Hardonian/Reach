# Reach OSS

Reach is a deterministic execution and replay platform. The OSS demo path is built around one run lifecycle:
**run → transcript → verify → replay**.

## Install in 60 seconds

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/reach/reach/main/scripts/install.sh | bash
export PATH="$HOME/.reach/bin:$PATH"
```

### Windows (PowerShell)

```powershell
iwr https://raw.githubusercontent.com/reach/reach/main/scripts/install.ps1 -UseBasicParsing | iex
$env:Path = "$HOME/.reach/bin;" + $env:Path
```

Installers download the latest GitHub release, verify `SHA256SUMS`, and install `reach` plus a `reachctl` compatibility alias. If no release is available, they build locally from source.

## Verify install

```bash
reach version
reach doctor
reach bugreport
```

## Offline build path

If you are in an offline or air-gapped environment, clone the repository and build locally:

```bash
git clone https://github.com/reach/reach.git
cd reach
./scripts/install.sh
```

This path skips remote downloads and compiles `services/runner/cmd/reachctl` locally.

## 10-minute quickstart

### 1) One-command sample lifecycle

```bash
reach demo
```

This command performs run → capsule create → capsule verify → capsule replay using the local OSS path.

### 2) Open the OSS demo Evidence Viewer

```bash
cd apps/arcade
npm install
npm run dev
```

Then open `http://localhost:3000/demo/evidence-viewer` and click **Load sample run**.

## Security & SBOM

- CI runs dependency scans with `npm audit --audit-level=high` and `govulncheck`.
- CycloneDX SBOMs are generated in CI at:
  - `sbom/go-reachctl.cdx.json`
  - `sbom/node-root.cdx.json`
- Release assets also include `sbom-go.cdx.json`, `sbom-node.cdx.json`, and `SHA256SUMS`.

## Supported platforms

Official release binaries are produced for:

- Linux: `amd64`, `arm64`
- macOS: `amd64`, `arm64`
- Windows: `amd64`, `arm64`

## OSS demo scope

Fully working in OSS:

- Run metadata + transcript timeline viewing.
- Proof hash rendering when present in evidence.
- Verify/replay adapter via local `reach` when installed.
- Graceful fallback to static evidence viewing when CLI is unavailable.
- JSON evidence export from the viewer.

Explicitly stubbed (enterprise):

- Team RBAC automation.
- Cloud key custody and signing orchestration.
- Multi-tenant cloud audit stream management.

## Troubleshooting

- **`reach` not found**: add `$HOME/.reach/bin` to `PATH`.
- **Replay needs a run ID**: generate a run first (`reach run demo-pack --json`).
- **Viewer verify/replay says fallback mode**: CLI is unavailable; install with `./scripts/install.sh` and retry.
- **Need diagnostics for bug reports**: include `reach doctor
reach bugreport --json` output.

## Contributing + feedback

- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Issue templates: [.github/ISSUE_TEMPLATE](.github/ISSUE_TEMPLATE)
- Required diagnostics for execution bugs: `reachctl doctor --json`, plus replay/verify command output.


## How we avoid auth bleed + hard-500s

In plain language:
- Public marketing pages stay isolated from authenticated provider code. CI blocks imports from app-only auth/provider modules into marketing surfaces.
- Marketing pages also cannot depend on import-time env guards that throw during bundle load. CI fails if those imports appear.
- Deterministic run boundaries are scanned for non-deterministic primitives (`time.Now`, random generators, locale-dependent sorting).
- Demo and API routes return structured JSON errors instead of crashing paths.

If one of these rules is broken, CI fails before merge.
