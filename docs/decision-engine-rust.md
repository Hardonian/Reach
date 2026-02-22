# Decision Engine - Rust Implementation

Last Updated: 2026-02-22

## Overview

The decision engine is a Rust-first quant decision library with WebAssembly bindings for use in JavaScript/TypeScript environments. It provides deterministic, byte-stable decision-making algorithms for robust decisions under uncertainty.

## Architecture

```
crates/decision-engine/
├── Cargo.toml           # Package configuration with WASM support
├── src/
│   ├── lib.rs           # Main entry point and re-exports
│   ├── types.rs         # Core type definitions
│   ├── engine.rs        # Decision algorithms
│   ├── determinism.rs   # Canonical JSON and fingerprinting
│   └── wasm.rs          # WASM bindings
└── tests/               # Unit and integration tests
```

## Building

### Native Build

```bash
cd crates/decision-engine
cargo build
cargo test
```

### WASM Build

Prerequisites:
- `rustup target add wasm32-unknown-unknown`
- `cargo install wasm-pack`

```bash
# Build for Node.js
wasm-pack build --target nodejs --out-dir ../../packages/decision-engine-wasm/wasm

# Build for browser
wasm-pack build --target web --out-dir ../../packages/decision-engine-wasm/wasm
```

## Usage

### Rust

```rust
use decision_engine::{evaluate_decision, types::*};

let input = DecisionInput {
    id: Some("my_decision".to_string()),
    actions: vec![
        ActionOption { id: "buy".to_string(), label: "Buy".to_string() },
        ActionOption { id: "sell".to_string(), label: "Sell".to_string() },
    ],
    scenarios: vec![
        Scenario { id: "bull".to_string(), probability: Some(0.6), adversarial: false },
        Scenario { id: "bear".to_string(), probability: Some(0.4), adversarial: true },
    ],
    outcomes: vec![
        ("buy".to_string(), "bull".to_string(), 100.0),
        ("buy".to_string(), "bear".to_string(), -50.0),
        ("sell".to_string(), "bull".to_string(), -20.0),
        ("sell".to_string(), "bear".to_string(), 30.0),
    ],
    constraints: None,
    evidence: None,
    meta: None,
};

let output = evaluate_decision(&input).unwrap();
println!("Recommended: {}", output.ranked_actions[0].action_id);
println!("Fingerprint: {}", output.determinism_fingerprint);
```

### WASM (JavaScript/TypeScript)

```javascript
const { evaluate_decision_json } = require('./decision_engine.js');

const input = {
    actions: [{ id: "buy", label: "Buy" }],
    scenarios: [{ id: "bull", probability: 1.0, adversarial: false }],
    outcomes: [["buy", "bull", 100]]
};

const result = evaluate_decision_json(JSON.stringify(input));
const output = JSON.parse(result);

if (output.ok) {
    console.log("Recommended:", output.data.ranked_actions[0].action_id);
} else {
    console.error("Error:", output.error.code, output.error.message);
}
```

## WASM API

### `evaluate_decision_json(input: string) -> string`

Evaluate a decision from JSON input.

**Input:** JSON string representing a `DecisionInput`

**Output:** JSON string with structure:
```json
{
  "ok": true,
  "data": {
    "ranked_actions": [...],
    "determinism_fingerprint": "...",
    "trace": {...}
  }
}
```

On error:
```json
{
  "ok": false,
  "error": {
    "code": "E_INVALID_INPUT",
    "message": "...",
    "details": {...}
  }
}
```

### `compute_fingerprint_json(input: string) -> string`

Compute the SHA-256 fingerprint for a decision input.

**Output:**
```json
{
  "ok": true,
  "data": {
    "fingerprint": "64-character-hex-string"
  }
}
```

### `get_engine_version() -> string`

Get the engine version.

**Output:**
```json
{
  "ok": true,
  "data": {
    "version": "0.2.0"
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `E_SCHEMA` | Invalid JSON schema (malformed JSON or missing required fields) |
| `E_INVALID_INPUT` | Invalid input values (e.g., empty actions, invalid probabilities) |
| `E_NOT_FOUND` | Referenced entity not found |
| `E_INTERNAL` | Internal error (should not occur in normal operation) |

## Determinism Guarantees

1. **Byte-stable outputs**: Same input always produces identical JSON output
2. **Canonical JSON**: Keys sorted lexicographically, floats normalized to 1e-9 precision
3. **SHA-256 fingerprints**: 64-character hex string from canonical input
4. **Tie-breaking**: Actions sorted lexicographically by `action_id`
5. **No entropy sources**: No `time::now()`, `rand()`, or UUID generation

## Algorithms

### Worst-case (Maximin)

For each action, find the minimum utility across all scenarios:
```
worst_case[action] = min(scenarios, utility[action, scenario])
```

### Minimax Regret

1. For each scenario, find the best utility:
   ```
   best[scenario] = max(actions, utility[action, scenario])
   ```
2. Compute regret for each action-scenario pair:
   ```
   regret[action, scenario] = best[scenario] - utility[action, scenario]
   ```
3. For each action, find the maximum regret:
   ```
   max_regret[action] = max(scenarios, regret[action, scenario])
   ```

### Adversarial Robustness

For each action, find the minimum utility across adversarial scenarios only:
```
adversarial[action] = min(adversarial_scenarios, utility[action, scenario])
```

### Composite Score

Weighted combination:
```
composite = 0.4 * worst_case + 0.4 * (100 - max_regret) + 0.2 * adversarial
```

Note: Max regret is inverted so higher is better.

## Testing

```bash
# Run all tests
cargo test -p decision-engine

# Run specific test
cargo test -p decision-engine test_determinism_comprehensive

# Run with output
cargo test -p decision-engine -- --nocapture
```

## Troubleshooting

### WASM build fails

Ensure you have the WASM target installed:
```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

### Non-deterministic outputs

Check for:
1. Unsorted maps (use `BTreeMap` instead of `HashMap`)
2. Float precision issues (use `float_normalize()`)
3. Array order sensitivity (sort by ID before hashing)

### Type mismatches between Rust and TypeScript

Ensure field names match:
- Rust: `snake_case` → TypeScript: `camelCase`
- The wrapper handles conversion automatically

## Related Documentation

- [CANONICALIZATION_SPEC.md](CANONICALIZATION_SPEC.md) - Canonical JSON specification
- [DETERMINISM_SPEC.md](DETERMINISM_SPEC.md) - Determinism requirements
- [packages/decision-engine-wasm/README.md](../packages/decision-engine-wasm/README.md) - TypeScript wrapper
