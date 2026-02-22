//! Core types for the decision engine.
//!
//! All types are designed for deterministic serialization and stable hashing.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// An action option available in a decision context.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ActionOption {
    /// Unique identifier for the action (used for stable tie-breaking).
    pub id: String,
    /// Human-readable label for the action.
    pub label: String,
}

/// A scenario representing a possible state of the world.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Scenario {
    /// Unique identifier for the scenario.
    pub id: String,
    /// Probability of the scenario occurring (0.0 to 1.0).
    /// If None, all scenarios are treated as equally likely.
    pub probability: Option<f64>,
    /// Whether this scenario represents an adversarial condition.
    /// Adversarial scenarios are weighted differently in robust scoring.
    #[serde(default)]
    pub adversarial: bool,
}

/// A constraint on the decision space.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionConstraint {
    /// Unique identifier for the constraint.
    pub id: String,
    /// Name of the constraint.
    pub name: String,
    /// Value of the constraint (e.g., "7d" for deadline).
    pub value: String,
    /// Status of the constraint (e.g., "assumption", "verified").
    pub status: String,
}

/// Evidence metadata for a decision.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionEvidence {
    /// Drift score (0.0 to 1.0) indicating how much evidence has changed.
    #[serde(default)]
    pub drift: Option<f64>,
    /// Trust score (0.0 to 1.0) indicating confidence in evidence quality.
    #[serde(default)]
    pub trust: Option<f64>,
    /// Policy compliance score (0.0 to 1.0).
    #[serde(default)]
    pub policy: Option<f64>,
    /// Provenance information for the evidence.
    #[serde(default)]
    pub provenance: Option<String>,
}

/// Metadata for a decision (does NOT affect scoring unless explicitly included).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionMeta {
    /// Creation timestamp in ISO 8601 format.
    #[serde(default)]
    pub created_at: Option<String>,
    /// Version of the decision schema.
    #[serde(default)]
    pub version: Option<String>,
}

/// Input to a decision evaluation.
///
/// Contains all information needed to compute robust decision metrics.
/// The order of actions and scenarios does NOT affect the output;
/// all internal processing uses stable, sorted ordering.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionInput {
    /// Optional identifier for the decision.
    #[serde(default)]
    pub id: Option<String>,
    /// Available actions to choose from.
    pub actions: Vec<ActionOption>,
    /// Possible scenarios that may occur.
    pub scenarios: Vec<Scenario>,
    /// Outcome matrix as (action_id, scenario_id, utility) tuples.
    /// Higher utility values are preferred.
    pub outcomes: Vec<(String, String, f64)>,
    /// Optional constraints on the decision.
    #[serde(default)]
    pub constraints: Option<Vec<DecisionConstraint>>,
    /// Optional evidence metadata.
    #[serde(default)]
    pub evidence: Option<DecisionEvidence>,
    /// Optional metadata (does NOT affect scoring).
    #[serde(default)]
    pub meta: Option<DecisionMeta>,
}

/// A ranked action with computed scores.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RankedAction {
    /// Action identifier.
    pub action_id: String,
    /// Worst-case utility (minimum across all scenarios).
    pub score_worst_case: f64,
    /// Maximum regret across all scenarios.
    pub score_minimax_regret: f64,
    /// Adversarial robustness score (worst-case over adversarial subset).
    pub score_adversarial: f64,
    /// Composite score (weighted aggregation).
    pub composite_score: f64,
    /// Whether this action is recommended.
    pub recommended: bool,
    /// Rank (1 = best).
    pub rank: usize,
}

/// Intermediate computation tables for transparency and debugging.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionTrace {
    /// Utility table: action_id -> scenario_id -> utility.
    pub utility_table: BTreeMap<String, BTreeMap<String, f64>>,
    /// Worst-case table: action_id -> minimum utility.
    pub worst_case_table: BTreeMap<String, f64>,
    /// Regret table: action_id -> scenario_id -> regret.
    pub regret_table: BTreeMap<String, BTreeMap<String, f64>>,
    /// Maximum regret per action: action_id -> max_regret.
    pub max_regret_table: BTreeMap<String, f64>,
    /// Adversarial worst-case table: action_id -> minimum utility over adversarial scenarios.
    pub adversarial_table: BTreeMap<String, f64>,
    /// Weights used for composite scoring.
    pub composite_weights: CompositeWeights,
    /// Tie-break rule applied (always lexicographic by action_id).
    pub tie_break_rule: String,
}

/// Weights for composite score computation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompositeWeights {
    /// Weight for worst-case score (default: 0.4).
    pub worst_case: f64,
    /// Weight for minimax regret score (default: 0.4).
    /// Note: Regret is inverted (1.0 - normalized_regret) before weighting.
    pub minimax_regret: f64,
    /// Weight for adversarial robustness score (default: 0.2).
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

/// Output from a decision evaluation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionOutput {
    /// Ranked actions in order of preference.
    pub ranked_actions: Vec<RankedAction>,
    /// SHA-256 fingerprint of the canonical input JSON.
    pub determinism_fingerprint: String,
    /// Trace of intermediate computations.
    pub trace: DecisionTrace,
}

impl DecisionOutput {
    /// Returns the ID of the recommended action, if any.
    pub fn recommended_action_id(&self) -> Option<&str> {
        self.ranked_actions
            .iter()
            .find(|a| a.recommended)
            .map(|a| a.action_id.as_str())
    }
}

/// Flip distance result for sensitivity analysis.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FlipDistance {
    /// Variable/assumption ID.
    pub variable_id: String,
    /// Distance (magnitude of change) needed to flip the decision.
    pub flip_distance: f64,
    /// The new top action if this variable flips.
    pub new_top_action: String,
}

/// Value of Information ranking for evidence prioritization.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VoiRanking {
    /// Action/evidence ID.
    pub action_id: String,
    /// Expected value of information.
    pub evoi: f64,
    /// Recommendation: "do_now", "plan_later", or "defer".
    pub recommendation: String,
    /// Rationale for the recommendation.
    pub rationale: Vec<String>,
}

/// Regret-bounded plan output.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RegretBoundedPlan {
    /// Plan identifier.
    pub id: String,
    /// Decision ID this plan is for.
    pub decision_id: String,
    /// Actions in the plan.
    pub actions: Vec<PlannedAction>,
    /// Bounded horizon (max actions).
    pub bounded_horizon: usize,
}

/// An action within a regret-bounded plan.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlannedAction {
    /// Action ID.
    pub id: String,
    /// Rationale for including this action.
    pub rationale: Vec<String>,
}

/// Decision boundary explanation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionBoundary {
    /// Current top action.
    pub top_action: String,
    /// Nearest flip distances (sorted by distance).
    pub nearest_flips: Vec<FlipDistance>,
}

/// Referee adjudication result.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RefereeAdjudication {
    /// Whether the proposal was accepted.
    pub accepted: bool,
    /// The agent's claimed action.
    pub agent_claim: Option<String>,
    /// The computed boundary.
    pub boundary: DecisionBoundary,
    /// What would need to change for the claim to be accepted.
    pub what_would_change: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

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
                    action_id: "action_b".to_string(),
                    score_worst_case: 40.0,
                    score_minimax_regret: 20.0,
                    score_adversarial: 40.0,
                    composite_score: 0.6,
                    recommended: false,
                    rank: 2,
                },
                RankedAction {
                    action_id: "action_a".to_string(),
                    score_worst_case: 20.0,
                    score_minimax_regret: 40.0,
                    score_adversarial: 20.0,
                    composite_score: 0.8,
                    recommended: true,
                    rank: 1,
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
        assert_eq!(output.recommended_action_id(), Some("action_a"));
    }
}
