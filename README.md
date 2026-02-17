# Reach

Reach is an OSS stack for running deterministic agent workflows across a **mobile cockpit**, a **Go runner**, a **Rust engine**, and **MCP-compatible tools**.

## Architecture

### 1) Mobile cockpit (`apps/mobile/android`)
The Android app is the operator-facing cockpit. It collects user intent, shows run progress, and presents tool outcomes.

### 2) Go runner (`services/runner`)
The runner hosts execution-facing APIs and orchestration glue:
- receives run requests from the cockpit,
- coordinates tool execution,
- bridges transport boundaries,
- forwards deterministic decisions to/from the Rust engine.

### 3) Rust engine (`crates/engine`)
The engine is the deterministic core:
- workflow compilation,
- policy-aware run state transitions,
- next-action selection,
- tool result application.

The engine performs no direct networking or shell execution.

### 4) MCP tools + protocol (`protocol/*`)
Schemas in `protocol/schemas` define the event and tool-call contracts used between components. MCP tool integrations are implemented around these contracts so clients and runner can evolve safely.

## Repository layout

- `apps/mobile/android` — Android cockpit app.
- `services/runner` — Go runner service.
- `crates/engine` — Rust deterministic engine.
- `crates/ffi/*` — interop layers for non-Rust consumers.
- `protocol/schemas` — JSON Schemas for protocol events/tool calls/artifacts.
- `tools/codegen/validate-protocol.mjs` — protocol schema validation entrypoint.
- `tools/dev.sh` — one-command contributor check script.

## One-command path for new contributors

From repo root:

```bash
./tools/dev.sh
```

This validates protocol schemas and runs core Rust + Go tests in one pass.

## CI checks (umbrella workflow)

GitHub Actions runs:
- protocol schema validation,
- Rust formatting/lint/tests,
- Go vet/tests.

See `.github/workflows/ci.yml`.
