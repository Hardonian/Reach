# Reach

Reach provides a deterministic Rust engine for an agentic mobile cockpit + remote runner architecture.

## Repository layout

- `crates/engine`: Pure Rust core (workflow, policy, run state, tool calls, artifacts).
- `crates/ffi/uniffi`: UniFFI wrapper for Kotlin/Swift callers.
- `crates/ffi/c_abi`: C ABI wrapper for Go or other C-compatible consumers.
- `protocol/schemas`: JSON Schema definitions for events, toolcalls, and artifacts.

## Public engine API (v0)

- `Engine::new(config)`
- `Engine::compile(workflow_dsl_or_json) -> Workflow`
- `Engine::start_run(workflow, policy) -> RunHandle`
- `RunHandle::next_action() -> Action`
- `RunHandle::apply_tool_result(tool_result)`

The engine is deterministic by default and performs no networking, MCP transport, or shell execution.

## Checks

```bash
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test -p engine
```
