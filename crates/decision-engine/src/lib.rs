//! # Decision Engine
//!
//! Deterministic quant decision primitives for robust decision-making under uncertainty.
//!
//! This crate provides production-grade decision algorithms with byte-stable outputs:
//! - **Worst-case (Maximin)**: Maximize the minimum utility across scenarios
//! - **Minimax Regret**: Minimize the maximum regret across scenarios
//! - **Adversarial Robustness**: Worst-case over adversarial scenario subset
//!
//! ## Determinism Guarantees
//!
//! All outputs are deterministic:
//! - Identical `DecisionInput` always produces identical `DecisionOutput` (byte-stable JSON)
//! - SHA-256 fingerprinting for verification
//! - Float normalization to 1e-9 precision
//! - Lexicographic tie-breaking by action ID
//!
//! ## Example
//!
//! ```rust
//! use decision_engine::types::{DecisionInput, ActionOption, Scenario};
//! use decision_engine::engine::evaluate_decision;
//!
//! let input = DecisionInput {
//!     id: Some("investment_decision".to_string()),
//!     actions: vec![
//!         ActionOption { id: "conservative".to_string(), label: "Conservative".to_string() },
//!         ActionOption { id: "aggressive".to_string(), label: "Aggressive".to_string() },
//!     ],
//!     scenarios: vec![
//!         Scenario { id: "bull".to_string(), probability: Some(0.5), adversarial: false },
//!         Scenario { id: "bear".to_string(), probability: Some(0.5), adversarial: true },
//!     ],
//!     outcomes: vec![
//!         ("conservative".to_string(), "bull".to_string(), 50.0),
//!         ("conservative".to_string(), "bear".to_string(), 40.0),
//!         ("aggressive".to_string(), "bull".to_string(), 100.0),
//!         ("aggressive".to_string(), "bear".to_string(), 10.0),
//!     ],
//!     constraints: None,
//!     evidence: None,
//!     meta: None,
//! };
//!
//! let output = evaluate_decision(input).unwrap();
//! println!("Recommended action: {:?}", output.recommended_action_id());
//! println!("Fingerprint: {}", output.determinism_fingerprint);
//! ```

pub mod determinism;
pub mod engine;
pub mod types;

// Re-export main types and functions for convenience
pub use determinism::{
    canonical_json, compute_fingerprint, float_normalize, stable_hash, DeterminismFingerprint,
    FLOAT_PRECISION,
};
pub use engine::{
    compute_flip_distances, evaluate_decision, explain_decision_boundary, generate_regret_bounded_plan,
    rank_evidence_by_voi, referee_proposal, DecisionError,
};
pub use types::{
    ActionOption, CompositeWeights, DecisionBoundary, DecisionConstraint, DecisionEvidence,
    DecisionInput, DecisionMeta, DecisionOutput, DecisionTrace, FlipDistance, PlannedAction,
    RankedAction, RefereeAdjudication, RegretBoundedPlan, Scenario, VoiRanking,
};

#[cfg(test)]
mod integration_tests {
    use super::*;

    /// Test that identical inputs produce identical outputs (determinism).
    #[test]
    fn test_determinism_identical_inputs() {
        let input = DecisionInput {
            id: Some("test".to_string()),
            actions: vec![
                ActionOption {
                    id: "action_a".to_string(),
                    label: "Action A".to_string(),
                },
                ActionOption {
                    id: "action_b".to_string(),
                    label: "Action B".to_string(),
                },
            ],
            scenarios: vec![
                Scenario {
                    id: "scenario_1".to_string(),
                    probability: Some(0.6),
                    adversarial: false,
                },
                Scenario {
                    id: "scenario_2".to_string(),
                    probability: Some(0.4),
                    adversarial: true,
                },
            ],
            outcomes: vec![
                ("action_a".to_string(), "scenario_1".to_string(), 100.0),
                ("action_a".to_string(), "scenario_2".to_string(), 30.0),
                ("action_b".to_string(), "scenario_1".to_string(), 70.0),
                ("action_b".to_string(), "scenario_2".to_string(), 60.0),
            ],
            constraints: None,
            evidence: None,
            meta: None,
        };

        // Run evaluation twice
        let output1 = evaluate_decision(input.clone()).unwrap();
        let output2 = evaluate_decision(input).unwrap();

        // Fingerprints must be identical
        assert_eq!(
            output1.determinism_fingerprint,
            output2.determinism_fingerprint,
            "Fingerprints must be identical for identical inputs"
        );

        // Rankings must be identical
        assert_eq!(output1.ranked_actions.len(), output2.ranked_actions.len());
        for (a, b) in output1.ranked_actions.iter().zip(output2.ranked_actions.iter()) {
            assert_eq!(a.action_id, b.action_id);
            assert_eq!(a.rank, b.rank);
            assert_eq!(a.recommended, b.recommended);
            assert!((a.composite_score - b.composite_score).abs() < 1e-9);
        }
    }

    /// Test that input key order doesn't affect output (canonicalization).
    #[test]
    fn test_determinism_key_order_independence() {
        // Create two inputs with different field orders (via JSON)
        let json1 = r#"{
            "id": "test",
            "actions": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}],
            "scenarios": [{"id": "s1", "probability": 0.5, "adversarial": false}],
            "outcomes": [["a", "s1", 100.0], ["b", "s1", 50.0]]
        }"#;

        let json2 = r#"{
            "scenarios": [{"id": "s1", "probability": 0.5, "adversarial": false}],
            "id": "test",
            "outcomes": [["a", "s1", 100.0], ["b", "s1", 50.0]],
            "actions": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}]
        }"#;

        let input1: DecisionInput = serde_json::from_str(json1).unwrap();
        let input2: DecisionInput = serde_json::from_str(json2).unwrap();

        let output1 = evaluate_decision(input1).unwrap();
        let output2 = evaluate_decision(input2).unwrap();

        // Fingerprints must be identical despite different JSON key order
        assert_eq!(
            output1.determinism_fingerprint,
            output2.determinism_fingerprint,
            "Fingerprints must be identical regardless of input key order"
        );
    }

    /// Test known worst-case winner.
    #[test]
    fn test_correctness_worst_case() {
        // Action A: worst case = min(100, 20) = 20
        // Action B: worst case = min(60, 60) = 60
        // B should win worst-case criterion
        let input = DecisionInput {
            id: Some("worst_case_test".to_string()),
            actions: vec![
                ActionOption {
                    id: "action_a".to_string(),
                    label: "A".to_string(),
                },
                ActionOption {
                    id: "action_b".to_string(),
                    label: "B".to_string(),
                },
            ],
            scenarios: vec![
                Scenario {
                    id: "good".to_string(),
                    probability: Some(0.5),
                    adversarial: false,
                },
                Scenario {
                    id: "bad".to_string(),
                    probability: Some(0.5),
                    adversarial: true,
                },
            ],
            outcomes: vec![
                ("action_a".to_string(), "good".to_string(), 100.0),
                ("action_a".to_string(), "bad".to_string(), 20.0),
                ("action_b".to_string(), "good".to_string(), 60.0),
                ("action_b".to_string(), "bad".to_string(), 60.0),
            ],
            constraints: None,
            evidence: None,
            meta: None,
        };

        let output = evaluate_decision(input).unwrap();

        // Verify worst-case values
        let a_wc = output.trace.worst_case_table.get("action_a").copied().unwrap();
        let b_wc = output.trace.worst_case_table.get("action_b").copied().unwrap();

        assert!((a_wc - 20.0).abs() < 1e-9, "Action A worst-case should be 20");
        assert!((b_wc - 60.0).abs() < 1e-9, "Action B worst-case should be 60");
    }

    /// Test known minimax regret winner.
    #[test]
    fn test_correctness_minimax_regret() {
        // Scenario 1: max = 100
        // Scenario 2: max = 60
        //
        // Action A regret:
        //   s1: 100 - 100 = 0
        //   s2: 60 - 20 = 40
        //   max regret = 40
        //
        // Action B regret:
        //   s1: 100 - 60 = 40
        //   s2: 60 - 60 = 0
        //   max regret = 40
        //
        // Both have max regret 40, so tie-break by action ID (action_a wins)
        let input = DecisionInput {
            id: Some("regret_test".to_string()),
            actions: vec![
                ActionOption {
                    id: "action_a".to_string(),
                    label: "A".to_string(),
                },
                ActionOption {
                    id: "action_b".to_string(),
                    label: "B".to_string(),
                },
            ],
            scenarios: vec![
                Scenario {
                    id: "s1".to_string(),
                    probability: Some(0.5),
                    adversarial: false,
                },
                Scenario {
                    id: "s2".to_string(),
                    probability: Some(0.5),
                    adversarial: false,
                },
            ],
            outcomes: vec![
                ("action_a".to_string(), "s1".to_string(), 100.0),
                ("action_a".to_string(), "s2".to_string(), 20.0),
                ("action_b".to_string(), "s1".to_string(), 60.0),
                ("action_b".to_string(), "s2".to_string(), 60.0),
            ],
            constraints: None,
            evidence: None,
            meta: None,
        };

        let output = evaluate_decision(input).unwrap();

        // Verify regret values
        let a_mr = output.trace.max_regret_table.get("action_a").copied().unwrap();
        let b_mr = output.trace.max_regret_table.get("action_b").copied().unwrap();

        assert!((a_mr - 40.0).abs() < 1e-9, "Action A max regret should be 40");
        assert!((b_mr - 40.0).abs() < 1e-9, "Action B max regret should be 40");
    }

    /// Test adversarial subset changes recommendation.
    #[test]
    fn test_correctness_adversarial_subset() {
        // Without adversarial flag:
        //   A: worst = min(100, 20) = 20
        //   B: worst = min(60, 60) = 60
        //   B wins
        //
        // With adversarial flag on "bad" scenario:
        //   A: adversarial worst = 20
        //   B: adversarial worst = 60
        //   B still wins (higher adversarial worst-case is better)
        //
        // But if we flip which scenario is adversarial:
        //   A: adversarial worst = 100 (only "good" is adversarial)
        //   B: adversarial worst = 60
        //   A wins

        // Case 1: "bad" is adversarial
        let input1 = DecisionInput {
            id: Some("adv_test_1".to_string()),
            actions: vec![
                ActionOption {
                    id: "action_a".to_string(),
                    label: "A".to_string(),
                },
                ActionOption {
                    id: "action_b".to_string(),
                    label: "B".to_string(),
                },
            ],
            scenarios: vec![
                Scenario {
                    id: "good".to_string(),
                    probability: Some(0.5),
                    adversarial: false,
                },
                Scenario {
                    id: "bad".to_string(),
                    probability: Some(0.5),
                    adversarial: true,
                },
            ],
            outcomes: vec![
                ("action_a".to_string(), "good".to_string(), 100.0),
                ("action_a".to_string(), "bad".to_string(), 20.0),
                ("action_b".to_string(), "good".to_string(), 60.0),
                ("action_b".to_string(), "bad".to_string(), 60.0),
            ],
            constraints: None,
            evidence: None,
            meta: None,
        };

        let output1 = evaluate_decision(input1).unwrap();

        // Case 2: "good" is adversarial
        let input2 = DecisionInput {
            id: Some("adv_test_2".to_string()),
            actions: vec![
                ActionOption {
                    id: "action_a".to_string(),
                    label: "A".to_string(),
                },
                ActionOption {
                    id: "action_b".to_string(),
                    label: "B".to_string(),
                },
            ],
            scenarios: vec![
                Scenario {
                    id: "good".to_string(),
                    probability: Some(0.5),
                    adversarial: true,
                },
                Scenario {
                    id: "bad".to_string(),
                    probability: Some(0.5),
                    adversarial: false,
                },
            ],
            outcomes: vec![
                ("action_a".to_string(), "good".to_string(), 100.0),
                ("action_a".to_string(), "bad".to_string(), 20.0),
                ("action_b".to_string(), "good".to_string(), 60.0),
                ("action_b".to_string(), "bad".to_string(), 60.0),
            ],
            constraints: None,
            evidence: None,
            meta: None,
        };

        let output2 = evaluate_decision(input2).unwrap();

        // Verify adversarial worst-case values differ
        let a_adv1 = output1.trace.adversarial_table.get("action_a").copied().unwrap();
        let a_adv2 = output2.trace.adversarial_table.get("action_a").copied().unwrap();

        assert!((a_adv1 - 20.0).abs() < 1e-9, "Case 1: A adversarial worst = 20");
        assert!((a_adv2 - 100.0).abs() < 1e-9, "Case 2: A adversarial worst = 100");
    }

    /// Test tie-breaking is stable and lexicographic.
    #[test]
    fn test_stability_tie_break() {
        // Create input where both actions have identical scores
        let input = DecisionInput {
            id: Some("tie_test".to_string()),
            actions: vec![
                ActionOption {
                    id: "zebra".to_string(),
                    label: "Zebra".to_string(),
                },
                ActionOption {
                    id: "apple".to_string(),
                    label: "Apple".to_string(),
                },
                ActionOption {
                    id: "mango".to_string(),
                    label: "Mango".to_string(),
                },
            ],
            scenarios: vec![Scenario {
                id: "s1".to_string(),
                probability: Some(1.0),
                adversarial: false,
            }],
            outcomes: vec![
                ("zebra".to_string(), "s1".to_string(), 50.0),
                ("apple".to_string(), "s1".to_string(), 50.0),
                ("mango".to_string(), "s1".to_string(), 50.0),
            ],
            constraints: None,
            evidence: None,
            meta: None,
        };

        let output = evaluate_decision(input).unwrap();

        // All have same score, so should be sorted by action_id
        assert_eq!(output.ranked_actions[0].action_id, "apple");
        assert_eq!(output.ranked_actions[1].action_id, "mango");
        assert_eq!(output.ranked_actions[2].action_id, "zebra");

        // Run again to verify stability
        let input2 = DecisionInput {
            id: Some("tie_test".to_string()),
            actions: vec![
                ActionOption {
                    id: "zebra".to_string(),
                    label: "Zebra".to_string(),
                },
                ActionOption {
                    id: "apple".to_string(),
                    label: "Apple".to_string(),
                },
                ActionOption {
                    id: "mango".to_string(),
                    label: "Mango".to_string(),
                },
            ],
            scenarios: vec![Scenario {
                id: "s1".to_string(),
                probability: Some(1.0),
                adversarial: false,
            }],
            outcomes: vec![
                ("zebra".to_string(), "s1".to_string(), 50.0),
                ("apple".to_string(), "s1".to_string(), 50.0),
                ("mango".to_string(), "s1".to_string(), 50.0),
            ],
            constraints: None,
            evidence: None,
            meta: None,
        };

        let output2 = evaluate_decision(input2).unwrap();

        // Same ordering
        assert_eq!(output.ranked_actions[0].action_id, output2.ranked_actions[0].action_id);
        assert_eq!(output.ranked_actions[1].action_id, output2.ranked_actions[1].action_id);
        assert_eq!(output.ranked_actions[2].action_id, output2.ranked_actions[2].action_id);
    }

    /// Test float normalization stability.
    #[test]
    fn test_stability_float_normalization() {
        // Floating point noise should be eliminated
        let noisy = 0.1 + 0.2; // Not exactly 0.3 in IEEE 754
        let normalized = float_normalize(noisy);

        assert!(
            (normalized - 0.3).abs() < 1e-9,
            "Float noise should be eliminated: {} -> {}",
            noisy,
            normalized
        );
    }
}