//! Decision Engine - Robust Quant Decision Primitives
//!
//! A deterministic decision-making library extracted from Zeolite,
//! implementing robust quant decision algorithms.
//!
//! ## Features
//!
//! - **Worst-case (Maximin)**: Maximize minimum utility across scenarios
//! - **Minimax Regret**: Minimize maximum regret
//! - **Adversarial Robustness**: Score against worst adversarial scenarios
//! - **Composite Scoring**: Weighted combination of all metrics
//! - **Deterministic Outputs**: Byte-stable JSON with SHA-256 fingerprints
//! - **WASM Support**: Full WebAssembly bindings for JavaScript/TypeScript
//!
//! ## Quick Start
//!
//! ```rust
//! use decision_engine::{evaluate_decision, types::*};
//!
//! let input = DecisionInput {
//!     id: Some("my_decision".to_string()),
//!     actions: vec![
//!         ActionOption { id: "a1".to_string(), label: "Action 1".to_string() },
//!         ActionOption { id: "a2".to_string(), label: "Action 2".to_string() },
//!     ],
//!     scenarios: vec![
//!         Scenario { id: "s1".to_string(), probability: Some(0.5), adversarial: false },
//!         Scenario { id: "s2".to_string(), probability: Some(0.5), adversarial: true },
//!     ],
//!     outcomes: vec![
//!         ("a1".to_string(), "s1".to_string(), 100.0),
//!         ("a1".to_string(), "s2".to_string(), 50.0),
//!         ("a2".to_string(), "s1".to_string(), 90.0),
//!         ("a2".to_string(), "s2".to_string(), 60.0),
//!     ],
//!     constraints: None,
//!     evidence: None,
//!     meta: None,
//! };
//!
//! let output = evaluate_decision(&input).unwrap();
//! println!("Recommended: {}", output.ranked_actions[0].action_id);
//! println!("Fingerprint: {}", output.determinism_fingerprint);
//! ```
//!
//! ## WASM Usage
//!
//! ```javascript
//! const wasm = await import('./decision_engine.js');
//! const result = wasm.evaluate_decision_json(JSON.stringify(input));
//! const output = JSON.parse(result);
//! ```

pub mod determinism;
pub mod engine;
pub mod types;
pub mod wasm;

// Re-export main types and functions for convenience
pub use determinism::{
    canonical_json, compute_fingerprint, float_normalize, stable_hash, DeterminismFingerprint,
};

pub use engine::{
    compute_flip_distances, evaluate_decision, explain_decision_boundary,
    generate_regret_bounded_plan, rank_evidence_by_voi, referee_proposal, DecisionError,
};

pub use types::{
    ActionOption, CompositeWeights, DecisionBoundary, DecisionConstraint,
    DecisionEvidence, DecisionInput, DecisionMeta, DecisionOutput, DecisionTrace,
    FlipDistance, PlannedAction, RankedAction, RefereeAdjudication, RegretBoundedPlan,
    Scenario, VoiRanking,
};

// Re-export WASM functions for non-WASM builds
#[cfg(not(target_arch = "wasm32"))]
pub use wasm::{
    compute_fingerprint_json, evaluate_decision_json, get_engine_version, ErrorDetail,
    WasmError, WasmSuccess,
};

#[cfg(target_arch = "wasm32")]
pub use wasm::{
    compute_fingerprint_json, evaluate_decision_json, get_engine_version, ErrorDetail,
    WasmError, WasmSuccess,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_decision_pipeline() {
        let input = DecisionInput {
            id: Some("pipeline_test".to_string()),
            actions: vec![
                ActionOption {
                    id: "buy".to_string(),
                    label: "Buy".to_string(),
                },
                ActionOption {
                    id: "hold".to_string(),
                    label: "Hold".to_string(),
                },
                ActionOption {
                    id: "sell".to_string(),
                    label: "Sell".to_string(),
                },
            ],
            scenarios: vec![
                Scenario {
                    id: "bull".to_string(),
                    probability: Some(0.4),
                    adversarial: false,
                },
                Scenario {
                    id: "bear".to_string(),
                    probability: Some(0.3),
                    adversarial: true,
                },
                Scenario {
                    id: "flat".to_string(),
                    probability: Some(0.3),
                    adversarial: false,
                },
            ],
            outcomes: vec![
                // Buy outcomes
                ("buy".to_string(), "bull".to_string(), 100.0),
                ("buy".to_string(), "bear".to_string(), -50.0),
                ("buy".to_string(), "flat".to_string(), 10.0),
                // Hold outcomes
                ("hold".to_string(), "bull".to_string(), 30.0),
                ("hold".to_string(), "bear".to_string(), -10.0),
                ("hold".to_string(), "flat".to_string(), 5.0),
                // Sell outcomes
                ("sell".to_string(), "bull".to_string(), -20.0),
                ("sell".to_string(), "bear".to_string(), 20.0),
                ("sell".to_string(), "flat".to_string(), 0.0),
            ],
            constraints: None,
            evidence: None,
            meta: None,
        };

        // Evaluate decision
        let output = evaluate_decision(&input).unwrap();

        // Check structure
        assert_eq!(output.ranked_actions.len(), 3);
        assert!(output.ranked_actions[0].recommended);

        // Check fingerprint is deterministic
        let fp = compute_fingerprint(&input);
        assert!(!fp.is_empty());
        assert_eq!(fp.len(), 64); // SHA-256 hex

        // Check flip distances
        let flips = compute_flip_distances(&input).unwrap();
        assert!(!flips.is_empty());

        // Check VOI ranking
        let voi = rank_evidence_by_voi(&input, 0.1).unwrap();
        assert!(!voi.is_empty());

        // Check regret-bounded plan
        let plan = generate_regret_bounded_plan(&input, 2, 0.1).unwrap();
        assert!(!plan.actions.is_empty());

        // Check decision boundary
        let boundary = explain_decision_boundary(&input).unwrap();
        assert!(!boundary.top_action.is_empty());

        // Check referee
        let referee = referee_proposal(&input, &boundary.top_action).unwrap();
        assert!(referee.accepted);
    }

    #[test]
    fn test_determinism_comprehensive() {
        // Test 1: Same input produces same fingerprint
        let input1 = DecisionInput {
            id: Some("det_test".to_string()),
            actions: vec![
                ActionOption {
                    id: "a".to_string(),
                    label: "A".to_string(),
                },
                ActionOption {
                    id: "b".to_string(),
                    label: "B".to_string(),
                },
            ],
            scenarios: vec![Scenario {
                id: "s".to_string(),
                probability: Some(1.0),
                adversarial: false,
            }],
            outcomes: vec![
                ("a".to_string(), "s".to_string(), 10.0),
                ("b".to_string(), "s".to_string(), 20.0),
            ],
            constraints: None,
            evidence: None,
            meta: None,
        };

        let input2 = input1.clone();

        let fp1 = compute_fingerprint(&input1);
        let fp2 = compute_fingerprint(&input2);

        assert_eq!(fp1, fp2);

        // Test 2: Different key order produces same fingerprint
        let mut input3 = input1.clone();
        input3.outcomes = vec![
            ("b".to_string(), "s".to_string(), 20.0),
            ("a".to_string(), "s".to_string(), 10.0),
        ];

        let fp3 = compute_fingerprint(&input3);
        assert_eq!(fp1, fp3);

        // Test 3: Float noise is normalized
        let mut input4 = input1.clone();
        input4.outcomes = vec![
            ("a".to_string(), "s".to_string(), 0.1 + 0.2 + 9.7), // Should equal 10.0
            ("b".to_string(), "s".to_string(), 20.0),
        ];

        let fp4 = compute_fingerprint(&input4);
        assert_eq!(fp1, fp4);

        // Test 4: Output JSON is byte-stable
        let out1 = evaluate_decision(&input1).unwrap();
        let out2 = evaluate_decision(&input2).unwrap();

        let json1 = serde_json::to_vec(&out1).unwrap();
        let json2 = serde_json::to_vec(&out2).unwrap();

        assert_eq!(json1, json2);
    }
}
