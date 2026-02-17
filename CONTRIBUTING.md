# Contributing

## Development

1. Install Rust stable.
2. Run checks from repo root:
   - `cargo fmt --check`
   - `cargo clippy --workspace --all-targets -- -D warnings`
   - `cargo test -p engine`

## Architecture rules

- `crates/engine` is deterministic core logic only.
- Transport adapters (UniFFI, C ABI, MCP runner) stay outside the engine crate.
- Protocol compatibility should be reflected in `protocol/schemas`.
