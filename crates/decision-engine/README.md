# Decision Engine

Deterministic quant decision primitives extracted from Zeolite into Rust for strong determinism guarantees.

## Overview

This crate provides robust quant decision-making algorithms under uncertainty, implementing:
- **Worst-case (Maximin)**: Maximize minimum utility across all scenarios
- **Minimax Regret**: Minimize maximum regret 
- **Adversarial Robustness**: Score against worst adversarial scenarios
- **Composite Scoring**: Weighted combination of all metrics

## Determinism Guarantees

This crate guarantees **byte-stable deterministic outputs**:

- **Identical inputs → Identical outputs**: Same `DecisionInput` always produces identical `DecisionOutput` and fingerprint
- **Canonical JSON**: Object keys sorted deeply, numbers normalized to 1e-9 precision
- **Stable SHA-256 fingerprints**: 64-character hex string computed from canonical JSON
- **Tie-breaking**: Actions sorted lexicographically by `action_id` for stable rankings
- **No runtime dependencies**: Pure computation with no `time.Now()`, `rand`, or UUID generation

## Installation

```toml
# Cargo.toml
[dependencies]
decision-engine = { path = "../crates/decision-engine" }
```

## Quick Start

```rust
use decision_engine::{evaluate_decision, types::*};

let input = DecisionInput {
    id: Some("my_decision".to_string()),
    actions: vec![
        ActionOption { id: "buy".to_string(), label: "Buy".to_string() },
        ActionOption { id: "hold".to_string(), label: "Hold".to_string() },
    ],
    scenarios: vec![
        Scenario { id: "bull".to_string(), probability: Some(0.5), adversarial: false },
        Scenario { id: "bear".to_string(), probability: Some(0.5), adversarial: true },
    ],
    outcomes: vec![
        ("buy".to_string(), "bull".to_string(), 100.0),
        ("buy".to_string(), "bear".to_string(), -50.0),
        ("hold".to_string(), "bull".to_string(), 30.0),
        ("hold".to_string(), "bear".to_string(), -10.0),
    ],
    constraints: None,
    evidence: None,
    meta: None,
};

let output = evaluate_decision(&input).unwrap();

println!("Recommended: {}", output.ranked_actions[0].action_id);
println!("Fingerprint: {}", output.determinism_fingerprint);
```

## Core Types

### DecisionInput
```rust
pub struct DecisionInput {
    pub id: Option<String>,
    pub actions: Vec<ActionOption>,
    pub scenarios: Vec<Scenario>,
    pub outcomes: Vec<(String, String, f64)>, // (action_id, scenario_id, utility)
    pub constraints: Option<DecisionConstraint>,
    pub evidence: Option<DecisionEvidence>,
    pub meta: Option<DecisionMeta>,
}
```

### DecisionOutput
```rust
pub struct DecisionOutput {
    pub ranked_actions: Vec<RankedAction>,
    pub determinism_fingerprint: String, // SHA-256 hex
    pub trace: DecisionTrace,
}
```

## Algorithms

### evaluate_decision
Main entry point that computes all metrics and returns ranked actions with composite scores.

### compute_flip_distances
Computes sensitivity thresholds - how much each assumption can change before the decision ranking flips.

### rank_evidence_by_voi
Ranks evidence by estimated Value of Information (VOI) given a minimum threshold.

### generate_regret_bounded_plan
Generates a sequence of evidence-gathering actions bounded by horizon and minimum VOI.

### explain_decision_boundary
Explains the current decision boundary and what would change the top action.

### referee_proposal
Adjudicates whether a proposed action matches the recommended boundary action.

## Running Tests

```bash
cargo test -p decision-engine
```

## Running Clippy

```bash
cargo clippy -p decision-engine
```

## Building

```bash
cargo build -p decision-engine
```

## License

MIT - See LICENSE file for details.
