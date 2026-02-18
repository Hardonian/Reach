# Contributing to Reach

Thanks for helping improve Reach.

## Setup

Prerequisites:
- Go 1.22+
- Rust stable (see `rust-toolchain.toml`)
- Node.js 18+

Install and verify:

```bash
npm install
(cd extensions/vscode && npm install)
npm run lint
npm run typecheck
npm run build
```

Recommended quick health check:

```bash
./reach doctor
```

## Branch strategy

- Branch from `main`.
- Use focused branches named like `feat/<scope>` or `fix/<scope>`.
- Keep PRs scoped to one behavior change when possible.

## Pull request guidelines

- Include a clear problem statement and root cause.
- Describe behavior changes and risk surface.
- Link related issues/specs.
- Add or update tests for behavior changes.
- Keep docs in sync for user-facing or operational changes.

## Testing expectations

Before opening a PR, run:

```bash
npm run verify:full
```

If your changes are limited to a subsystem, run targeted checks as well:

```bash
cargo test -p engine-core
(cd services/runner && go test ./...)
(cd extensions/vscode && npm run test)
```

## Security and responsible changes

- Never commit credentials or secrets.
- Preserve tenant isolation and capability boundaries.
- Prefer explicit policy and deterministic behavior over hidden fallbacks.

## Release workflow

- Update `CHANGELOG.md` and `VERSION` for release-worthy changes.
- Run `./reach release-check` before tagging.
- Review `docs/RELEASE.md` and `docs/RELEASE_CHECKLIST.md`.
