//! Core types for the decision engine.
//!
//! All types are designed for deterministic serialization:
//! - Uses `BTreeMap` instead of `HashMap` for sorted key order
//! - All floats are normalized to fixed precision
//! - Optional fields use `Option<T>` with explicit defaults

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// An action option in a decision problem.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ActionOption {
    /// Unique identifier for the action.
    pub id: String,
    /// Human-readable label for the action.
    pub label: String,
}

/// A scenario in a decision problem.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Scenario {
    /// Unique identifier for the scenario.
    pub id: String,
    /// Probability of the scenario occurring (0.0 to 1.0).
    /// If None, all scenarios are treated equally.
    pub probability: Option<f64>,
    /// Whether this scenario represents an adversarial/worst-case scenario.
    #[serde(default)]
    pub adversarial: bool,
}

/// Constraints on the decision problem.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct DecisionConstraint {
    /// Maximum acceptable regret.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_regret: Option<f64>,
    /// Risk tolerance level (0.0 to 1.0).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub risk_tolerance: Option<f64>,
    /// Additional constraints as key-value pairs.
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub additional: BTreeMap<String, String>,
}

/// Evidence for the decision problem.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct DecisionEvidence {
    /// Drift score (0.0 to 1.0).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drift: Option<f64>,
    /// Trust score (0.0 to 1.0).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trust: Option<f64>,
    /// Policy compliance score (0.0 to 1.0).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub policy: Option<f64>,
    /// Provenance information.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provenance: Option<String>,
}

/// Metadata for the decision (does NOT affect scoring).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct DecisionMeta {
    /// Creation timestamp (ISO 8601).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    /// Version string.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// Additional metadata.
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub additional: BTreeMap<String, String>,
}

/// Input to the decision engine.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionInput {
    /// Optional identifier for the decision.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Available actions.
    pub actions: Vec<ActionOption>,
    /// Possible scenarios.
    pub scenarios: Vec<Scenario>,
    /// Outcomes as (action_id, scenario_id, utility) tuples.
    pub outcomes: Vec<(String, String, f64)>,
    /// Optional constraints.
    #[serde(default)]
    pub constraints: Option<DecisionConstraint>,
    /// Optional evidence.
    #[serde(default)]
    pub evidence: Option<DecisionEvidence>,
    /// Optional metadata (does NOT affect scoring).
    #[serde(default)]
    pub meta: Option<DecisionMeta>,
}

/// A ranked action with scores.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RankedAction {
    /// Action identifier.
    pub action_id: String,
    /// Worst-case utility score.
    pub score_worst_case: f64,
    /// Maximum regret score.
    pub score_minimax_regret: f64,
    /// Adversarial robustness score.
    pub score_adversarial: f64,
    /// Composite score (weighted combination).
    pub composite_score: f64,
    /// Whether this action is recommended.
    pub recommended: bool,
    /// Rank (1 = best).
    pub rank: usize,
}

/// Weights for composite score calculation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompositeWeights {
    /// Weight for worst-case score.
    pub worst_case: f64,
    /// Weight for minimax regret score.
    pub minimax_regret: f64,
    /// Weight for adversarial robustness score.
    pub adversarial: f64,
}

impl Default for CompositeWeights {
    fn default() -> Self {
        Self {
            worst_case: 0.4,
            minimax_regret: 0.4,
            adversarial: 0.2,
        }
    }
}

/// Trace of the decision computation for reproducibility.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionTrace {
    /// Utility table: action_id -> scenario_id -> utility.
    pub utility_table: BTreeMap<String, BTreeMap<String, f64>>,
    /// Worst-case table: action_id -> minimum utility.
    pub worst_case_table: BTreeMap<String, f64>,
    /// Regret table: action_id -> scenario_id -> regret.
    pub regret_table: BTreeMap<String, BTreeMap<String, f64>>,
    /// Maximum regret table: action_id -> maximum regret.
    pub max_regret_table: BTreeMap<String, f64>,
    /// Adversarial worst-case table: action_id -> adversarial worst utility.
    pub adversarial_table: BTreeMap<String, f64>,
    /// Weights used for composite score.
    pub composite_weights: CompositeWeights,
    /// Tie-breaking rule used.
    pub tie_break_rule: String,
}

/// Output from the decision engine.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionOutput {
    /// Ranked actions (best first).
    pub ranked_actions: Vec<RankedAction>,
    /// SHA-256 fingerprint of the canonical input.
    pub determinism_fingerprint: String,
    /// Trace of the computation.
    pub trace: DecisionTrace,
}

impl DecisionOutput {
    /// Get the recommended action ID.
    pub fn recommended_action_id(&self) -> Option<&str> {
        self.ranked_actions
            .iter()
            .find(|a| a.recommended)
            .map(|a| a.action_id.as_str())
    }
}

/// Flip distance for sensitivity analysis.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FlipDistance {
    /// Variable/scenario ID.
    pub variable_id: String,
    /// Distance (magnitude of change) needed to flip the decision.
    pub flip_distance: f64,
    /// The action that would become top if this variable flips.
    pub new_top_action: String,
}

/// Value of Information ranking.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VoiRanking {
    /// Evidence action ID.
    pub action_id: String,
    /// Expected value of information.
    pub evoi: f64,
    /// Recommendation: "do_now", "plan_later", or "defer".
    pub recommendation: String,
    /// Rationale for the ranking.
    pub rationale: Vec<String>,
}

/// A planned action in a regret-bounded plan.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlannedAction {
    /// Action ID.
    pub id: String,
    /// Rationale for including this action.
    pub rationale: Vec<String>,
}

/// A regret-bounded plan.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RegretBoundedPlan {
    /// Plan ID (deterministic hash).
    pub id: String,
    /// Decision ID this plan is for.
    pub decision_id: String,
    /// Planned actions.
    pub actions: Vec<PlannedAction>,
    /// Bounded horizon.
    pub bounded_horizon: usize,
}

/// Decision boundary explanation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionBoundary {
    /// Current top action.
    pub top_action: String,
    /// Nearest flip distances.
    pub nearest_flips: Vec<FlipDistance>,
}

/// Referee adjudication result.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RefereeAdjudication {
    /// Whether the proposal was accepted.
    pub accepted: bool,
    /// The agent's claim.
    pub agent_claim: Option<String>,
    /// The computed decision boundary.
    pub boundary: DecisionBoundary,
    /// What would need to change for acceptance.
    pub what_would_change: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_action_option_serialization() {
        let action = ActionOption {
            id: "test_action".to_string(),
            label: "Test Action".to_string(),
        };

        let json = serde_json::to_string(&action).unwrap();
        let parsed: ActionOption = serde_json::from_str(&json).unwrap();

        assert_eq!(action, parsed);
    }

    #[test]
    fn test_scenario_serialization() {
        let scenario = Scenario {
            id: "test_scenario".to_string(),
            probability: Some(0.5),
            adversarial: true,
        };

        let json = serde_json::to_string(&scenario).unwrap();
        let parsed: Scenario = serde_json::from_str(&json).unwrap();

        assert_eq!(scenario, parsed);
    }

    #[test]
    fn test_scenario_default_adversarial() {
        let json = r#"{"id": "test", "probability": 0.5}"#;
        let scenario: Scenario = serde_json::from_str(json).unwrap();

        assert!(!scenario.adversarial);
    }

    #[test]
    fn test_decision_input_serialization() {
        let input = DecisionInput {
            id: Some("test_decision".to_string()),
            actions: vec![ActionOption {
                id: "a1".to_string(),
                label: "Action 1".to_string(),
            }],
            scenarios: vec![Scenario {
                id: "s1".to_string(),
                probability: Some(1.0),
                adversarial: false,
            }],
            outcomes: vec![("a1".to_string(), "s1".to_string(), 100.0)],
            constraints: None,
            evidence: None,
            meta: None,
        };

        let json = serde_json::to_string(&input).unwrap();
        let parsed: DecisionInput = serde_json::from_str(&json).unwrap();

        assert_eq!(input, parsed);
    }

    #[test]
    fn test_ranked_action_serialization() {
        let action = RankedAction {
            action_id: "test".to_string(),
            score_worst_case: 50.0,
            score_minimax_regret: 25.0,
            score_adversarial: 40.0,
            composite_score: 0.75,
            recommended: true,
            rank: 1,
        };

        let json = serde_json::to_string(&action).unwrap();
        let parsed: RankedAction = serde_json::from_str(&json).unwrap();

        assert_eq!(action, parsed);
    }

    #[test]
    fn test_composite_weights_default() {
        let weights = CompositeWeights::default();

        assert!((weights.worst_case - 0.4).abs() < 1e-9);
        assert!((weights.minimax_regret - 0.4).abs() < 1e-9);
        assert!((weights.adversarial - 0.2).abs() < 1e-9);

        // Weights should sum to 1.0
        let sum = weights.worst_case + weights.minimax_regret + weights.adversarial;
        assert!((sum - 1.0).abs() < 1e-9);
    }

    #[test]
    fn test_decision_output_recommended_action() {
        let output = DecisionOutput {
            ranked_actions: vec![
                RankedAction {
                    action_id: "a1".to_string(),
                    score_worst_case: 50.0,
                    score_minimax_regret: 25.0,
                    score_adversarial: 40.0,
                    composite_score: 0.75,
                    recommended: true,
                    rank: 1,
                },
                RankedAction {
                    action_id: "a2".to_string(),
                    score_worst_case: 40.0,
                    score_minimax_regret: 30.0,
                    score_adversarial: 35.0,
                    composite_score: 0.65,
                    recommended: false,
                    rank: 2,
                },
            ],
            determinism_fingerprint: "abc123".to_string(),
            trace: DecisionTrace {
                utility_table: BTreeMap::new(),
                worst_case_table: BTreeMap::new(),
                regret_table: BTreeMap::new(),
                max_regret_table: BTreeMap::new(),
                adversarial_table: BTreeMap::new(),
                composite_weights: CompositeWeights::default(),
                tie_break_rule: "lexicographic_by_action_id".to_string(),
            },
        };

        assert_eq!(output.recommended_action_id(), Some("a1"));
    }

    #[test]
    fn test_btree_map_sorted_keys() {
        let mut map: BTreeMap<String, f64> = BTreeMap::new();
        map.insert("zebra".to_string(), 3.0);
        map.insert("apple".to_string(), 1.0);
        map.insert("mango".to_string(), 2.0);

        // Keys should be sorted
        let keys: Vec<&String> = map.keys().collect();
        assert_eq!(keys[0], "apple");
        assert_eq!(keys[1], "mango");
        assert_eq!(keys[2], "zebra");
    }
}
