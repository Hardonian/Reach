//! Deterministic quant decision primitives for robust decision-making under uncertainty.
//!
//! This crate provides decision algorithms extracted from the Zeolite quant layer,
//! converted to Rust for strong determinism guarantees.
//!
//! # Features
//!
//! - **Minimax Regret**: Minimize maximum regret across scenarios
//! - **Worst-case / Maximin**: Robust decision making under adversarial conditions
//! - **Adversarial Robustness**: Scoring for deception resistance and dominance checks
//! - **Deterministic Outputs**: Byte-stable JSON serialization with SHA-256 fingerprinting
//!
//! # Example
//!
//! ```
//! use decision_engine::{DecisionInput, ActionOption, Scenario, evaluate_decision};
//!
//! let input = DecisionInput {
//!     id: Some("test-decision-001".to_string()),
//!     actions: vec![
//!         ActionOption { id: "action_a".to_string(), label: "Action A".to_string() },
//!         ActionOption { id: "action_b".to_string(), label: "Action B".to_string() },
//!     ],
//!     scenarios: vec![
//!         Scenario { id: "optimistic".to_string(), probability: Some(0.3), adversarial: false },
//!         Scenario { id: "pessimistic".to_string(), probability: Some(0.7), adversarial: false },
//!     ],
//!     outcomes: vec![
//!         ("action_a".to_string(), "optimistic".to_string(), 100.0),
//!         ("action_a".to_string(), "pessimistic".to_string(), 20.0),
//!         ("action_b".to_string(), "optimistic".to_string(), 60.0),
//!         ("action_b".to_string(), "pessimistic".to_string(), 40.0),
//!     ],
//!     constraints: None,
//!     evidence: None,
//!     meta: None,
//! };
//!
//! let output = evaluate_decision(input).expect("decision evaluation failed");
//! println!("Recommended action: {:?}", output.recommended_action_id());
//! println!("Fingerprint: {}", output.determinism_fingerprint);
//! ```

mod types;
mod determinism;
mod engine;

pub use types::*;
pub use determinism::{canonical_json, stable_hash, float_normalize, DeterminismFingerprint};
pub use engine::{evaluate_decision, DecisionError};
