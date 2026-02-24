# Reach OSS

Reach is a deterministic execution and replay platform. The OSS demo path is built around one run lifecycle:
**run → transcript → verify → replay**.

## 10-minute quickstart

### 1) Install CLI

**macOS / Linux**
```bash
./scripts/install.sh
export PATH="$HOME/.reach/bin:$PATH"
```

**Windows (PowerShell)**
```powershell
./scripts/install.ps1
$env:Path = "$HOME/.reach/bin;" + $env:Path
```

### 2) Validate local environment

```bash
reachctl doctor
```

### 3) Produce and verify a sample run

```bash
reachctl run demo-pack --json
reachctl list --limit 1 --json
reachctl verify-determinism --n=2 --json
```

### 4) Open the OSS demo Evidence Viewer

```bash
cd apps/arcade
npm install
npm run dev
```
Then open `http://localhost:3000/demo/evidence-viewer` and click **Load sample run**.

## OSS demo scope

Fully working in OSS:
- Run metadata + transcript timeline viewing.
- Proof hash rendering when present in evidence.
- Verify/replay adapter via local `reachctl` when installed.
- Graceful fallback to static evidence viewing when CLI is unavailable.
- JSON evidence export from the viewer.

Explicitly stubbed (enterprise):
- Team RBAC automation.
- Cloud key custody and signing orchestration.
- Multi-tenant cloud audit stream management.

## Troubleshooting

- **`reachctl` not found**: add `$HOME/.reach/bin` to `PATH`.
- **Replay needs a run ID**: generate a run first (`reachctl run demo-pack --json`).
- **Viewer verify/replay says fallback mode**: CLI is unavailable; install with `./scripts/install.sh` and retry.
- **Need diagnostics for bug reports**: include `reachctl doctor --json` output.

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
