# Harvest Notes - Zeolite to Reach Decision Engine

## Source Information

This crate was extracted from Zeolite (GLM-5) - a quant decision primitive library.

### Source Commits

- `40485d24a9472737e3e3c5b8de5261c52cb1659c` - Main zeolite-core.ts with decision operations
- `52f40077951ff9f9d2b330a317fb3c943444f400` - View model generation utilities
- `e6f2ebb948fbb1186ed89ef0cc52447740f42931` - Package restructuring

### Source Modules Used

1. **zeolite-core.ts** - Primary extraction source
    - `load_context` operation
    - `submit_evidence` operation
    - `compute_flip_distance` - Flip distance sensitivity analysis
    - `rank_evidence_by_voi` - Value of Information ranking
    - `generate_regret_bounded_plan` - Regret-bounded planning
    - `explain_decision_boundary` - Decision boundary explanation
    - `referee_proposal` - Proposal adjudication

2. **generateViewModel.ts** - Supporting utilities
    - View model generation patterns
    - Graph/node layout logic

## Rewrites and Rationale

### Conversion from TypeScript to Rust

| Original (TS) | Target (Rust) | Rationale |
| :--- | :--- | :--- |
| `executeZeoliteOperation` | `evaluate_decision` + individual functions | Modular Rust functions |
| OutcomeMatrix | `Vec<(String, String, f64)>` tuple | Simple, deterministic |
| Probabilistic scenarios | Explicit probability field | Clear semantics |
| JSON.stringify | `canonical_json` with sorted keys | Byte-stable output |
| `crypto.createHash` | `sha2` crate | Standard Rust crypto |
| Default scoring | Explicit `CompositeWeights` | Configurable, documented |

### Removed Dependencies

- `@zeo/contracts` - Replaced with local type definitions
- `@zeo/core` - Core logic extracted inline
- `node:crypto` - Replaced with `sha2` + `hex` crates

### Added for Determinism

- `ordered-float` - Deterministic float comparisons
- `hex` crate - Hex encoding for fingerprints
- Explicit sorting of all collections (BTreeMap, Vec::sort)

## Implementation Decisions

### 1. Outcome Storage

Used flat tuple representation `(action_id, scenario_id, utility)` instead of nested maps for:

- Simpler serialization
- Deterministic iteration order
- Easier validation

### 2. Float Handling

- All floats normalized to 1e-9 precision via `float_normalize()`
- Uses `ordered-float` crate for comparisons
- No floating point in hash computation paths

### 3. Tie-Breaking

- Actions sorted lexicographically by `action_id`
- Scenarios sorted lexicographically by `scenario_id`
- Guarantees stable output ordering

### 4. Composite Scoring

Default weights (documented in types):

- `worst_case`: 0.4
- `minimax_regret`: 0.4
- `adversarial`: 0.2

## Verification Commands

```bash
# Build
cargo build -p decision-engine

# Test
cargo test -p decision-engine

# Clippy
cargo clippy -p decision-engine

# Determinism verification (run multiple times)
cargo test -p decision-engine -- --nocapture
```

## Protobuf/Schema Notes

The DecisionInput/DecisionOutput types are designed to be schema-compatible:

- All fields have explicit types
- Optional fields use `Option<T>`
- Maps use BTreeMap for ordering
- Vectors have known element types

## Future Extensions (Not Included)

The following were NOT extracted to keep the crate minimal:

- Bayesian inference modules (not determinism-safe)
- LLM-based explanation generation
- Database/storage adapters
- Network I/O

## License

This code is MIT licensed, derived from Zeolite which is also MIT licensed.
