# Reach

**Reach is a deterministic execution fabric for AI systems.**

Reach helps teams run agentic and tool-driven workloads with deterministic replay, policy controls, and signed execution packs so production behavior can be trusted, audited, and reproduced.

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

```bash
npm install
(cd extensions/vscode && npm install)
npm run lint
npm run typecheck
npm run build
```

Run core tests:

```bash
npm run test
```

Run local health check:

```bash
./reach doctor
```

## CLI examples

```bash
# Validate release-critical gates
./reach release-check

# Environment and baseline diagnostics
./reach doctor

# Runner audit inspection helper
npm run audit:inspect
```

## Hosted vs OSS

- **OSS Reach (this repo)**: self-hosted services, protocol schemas, deterministic core, and extension integrations.
- **Hosted deployments**: managed operations, uptime/SLO ownership, and centralized observability run by your platform team or managed provider.

## Roadmap preview

- Deeper replay verification across orchestration boundaries
- Expanded federation controls and node compatibility checks
- Marketplace and signed connector distribution maturity
- Stronger observability for policy and replay invariants

## Contributing

- Read `CONTRIBUTING.md` for setup, branch strategy, and PR expectations.
- Use `npm run verify:full` before opening a PR.
- See `docs/` for architecture and execution-model references.

## License

Reach is licensed under the Apache License 2.0. See `LICENSE`.
