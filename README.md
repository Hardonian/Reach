# Reach

**Reach is a deterministic execution fabric for AI systems.**

Reach helps teams run agentic and tool-driven workloads with deterministic replay, policy controls, and signed execution packs so production behavior can be trusted, audited, and reproduced.

**[Documentation](https://reach.dev/docs)** | **[FAQ](https://reach.dev/faq)** | **[Support](https://reach.dev/support)**

## The problem Reach solves

Most AI systems fail in production because runtime behavior drifts: tools change, policies are bypassed, and replay is unreliable. Reach provides a stable execution plane so operators can enforce capability boundaries, verify integrity, and reproduce outcomes across nodes and environments.

## Core principles

- **Determinism**: replayable execution with stable event sequencing.
- **Policy enforcement**: explicit allow/deny gates around tools and permissions.
- **Signed packs**: immutable, integrity-checked execution artifacts.
- **Replay integrity**: snapshot and hash guards to detect drift and tampering.

## Architecture overview

```text
+-------------------+        +-------------------+
| Clients / IDEs    |  API   | services/runner   |
| Mobile / VS Code  +------->+ orchestration     |
+-------------------+        +---------+---------+
                                        |
                                        | execution packs + policy
                                        v
                              +---------+---------+
                              | crates/engine*    |
                              | deterministic core|
                              +---------+---------+
                                        |
                                        | tool calls / integrations
                                        v
                              +-------------------+
                              | MCP + connectors  |
                              +-------------------+
```

Key paths:

- `services/*` — Go services (runner, integration-hub, session-hub, registry)
- `crates/engine*` — Rust deterministic engine/core
- `extensions/vscode` — VS Code integration
- `protocol/schemas` — wire contract schemas

## Quickstart (5 minutes)

### Desktop/Server

```bash
npm install
(cd extensions/vscode && npm install)
npm run lint
npm run typecheck
npm run build
```

Run local health check:

```bash
./reach doctor
```

### Mobile (Android/Termux)

One-line installer:

```bash
curl -fsSL https://get.reach.dev/termux | bash
```

Then run the guided wizard:

```bash
reach wizard    # Choose pack -> Run -> Verify -> Share
reach operator  # View dashboard
```

See [Mobile Operator Guide](docs/MOBILE_OPERATOR_GUIDE.md) for details.

## CLI examples

### Desktop

```bash
# Validate release-critical gates
./reach release-check

# Environment and baseline diagnostics
./reach doctor

# Runner audit inspection helper
npm run audit:inspect
```

### Mobile

```bash
# Guided run wizard (mobile-friendly)
reach wizard

# Quick run a pack
reach run <pack-name>

# Share via QR code
reach share run <run-id>

# View operator dashboard
reach operator

# Mobile-specific health check
REACH_MOBILE=1 reach doctor
```

## Hosted vs OSS

- **OSS Reach (this repo)**: self-hosted services, protocol schemas, deterministic core, and extension integrations.
- **Hosted deployments**: managed operations, uptime/SLO ownership, and centralized observability run by your platform team or managed provider.

## Roadmap preview

- Deeper replay verification across orchestration boundaries
- Expanded federation controls and node compatibility checks
- Marketplace and signed connector distribution maturity
- Stronger observability for policy and replay invariants

## Troubleshooting

### Installation Issues

**Problem**: `npm install` fails

```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Problem**: Go dependencies not found

```bash
cd services/runner
go mod download
go mod tidy
```

**Problem**: Rust compilation errors

```bash
cd crates/engine
rustup update
cargo clean
cargo build --release
```

### Runtime Issues

**Problem**: `./reach doctor` fails

- Check Go version: `go version` (need 1.23+)
- Check Node version: `node --version` (need 18+)
- Check Rust: `rustc --version`

**Problem**: Port 8080 already in use

```bash
# Find and kill process
lsof -ti:8080 | xargs kill -9
# Or use different port
REACH_PORT=8081 ./reach doctor
```

**Problem**: Database locked errors

```bash
# Kill any hanging processes
pkill -f reach-runner
# Remove WAL files if corrupted
rm data/*.db-wal data/*.db-shm
```

**Problem**: `reach wizard` hangs

- Check SQLite installation
- Ensure data directory is writable: `chmod 755 data/`
- Run with debug logging: `REACH_LOG_LEVEL=debug reach wizard`

### Docker Issues

**Problem**: Container won't start

```bash
# View logs
docker-compose logs runner

# Rebuild
docker-compose down -v
docker-compose build --no-cache runner
docker-compose up -d
```

**Problem**: Permission denied on volumes

```bash
# Fix ownership
sudo chown -R 1000:1000 data/
docker-compose restart
```

### Mobile (Termux) Issues

**Problem**: `curl install` fails

```bash
# Update packages
pkg update
pkg install curl git

# Manual install
git clone https://github.com/yourorg/reach.git
cd reach
./install.sh
```

**Problem**: Out of memory errors

```bash
# Use swap
pkg install proot-distro
# Or reduce concurrency
REACH_MAX_CONCURRENT_RUNS=1 reach run <pack>
```

### Test Failures

**Problem**: Go tests timeout

```bash
# Run with longer timeout
cd services/runner
go test ./... -timeout 30s

# Run specific package
go test ./internal/storage -v
```

**Problem**: SQLite tests fail

- Check SQLite version: `sqlite3 --version` (need 3.35+)
- Ensure temp directory writable
- Check disk space

### Getting Help

1. Check logs: `REACH_LOG_LEVEL=debug <command>`
2. Run doctor: `./reach doctor`
3. Search issues: [GitHub Issues](../../issues)
4. Read docs: [docs/](./docs/)

## Documentation Integrity

Reach uses a **Docs Drift Guard** to ensure that documentation, environment variables, and CLI commands remain synchronized with the codebase.

- **Run Audit**: `npm run docs:doctor`
- **Autofix Casing**: `npm run docs:doctor:fix`
- **CI Enforcement**: Every PR is audited for broken links and stale "Repo Truth" references.

See [DOCS_DRIFT_GUARD.md](DOCS_DRIFT_GUARD.md) for detailed architecture.

## Contributing

- Read `CONTRIBUTING.md` for setup, branch strategy, and PR expectations.
- Use `npm run verify:full` before opening a PR.
- See `docs/` for architecture and execution-model references.

## License

Reach is licensed under the Apache License 2.0. See `LICENSE`.
