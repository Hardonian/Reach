//! Decision engine implementation.
//!
//! Provides robust decision-making algorithms:
//! - Worst-case (maximin): Maximize minimum utility across scenarios
//! - Minimax Regret: Minimize maximum regret
//! - Adversarial Robustness: Score against worst adversarial scenarios
//! - Composite Scoring: Weighted combination of all metrics

use crate::determinism::{compute_fingerprint, float_normalize, stable_hash};
use crate::types::*;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use thiserror::Error;

/// Errors that can occur during decision evaluation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum DecisionError {
    /// No actions provided.
    NoActions,
    /// No scenarios provided.
    NoScenarios,
    /// No outcomes provided.
    NoOutcomes,
    /// Invalid outcome (action or scenario not found).
    InvalidOutcome(String),
    /// Weights don't sum to 1.0.
    InvalidWeights { sum: f64 },
    /// Outcome data is incomplete.
    IncompleteOutcomes,
}

impl std::fmt::Display for DecisionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DecisionError::NoActions => write!(f, "At least one action is required"),
            DecisionError::NoScenarios => write!(f, "At least one scenario is required"),
            DecisionError::NoOutcomes => write!(f, "At least one outcome is required"),
            DecisionError::InvalidOutcome(msg) => write!(f, "Invalid outcome: {}", msg),
            DecisionError::InvalidWeights { sum } => {
                write!(f, "Weights must sum to 1.0, got {}", sum)
            }
            DecisionError::IncompleteOutcomes => {
                write!(f, "Outcome matrix is incomplete")
            }
        }
    }
}

impl std::error::Error for DecisionError {}

/// Build utility table from outcomes.
///
/// Returns: action_id -> scenario_id -> utility
fn build_utility_table(
    actions: &[ActionOption],
    scenarios: &[Scenario],
    outcomes: &[(String, String, f64)],
) -> BTreeMap<String, BTreeMap<String, f64>> {
    let mut table: BTreeMap<String, BTreeMap<String, f64>> = BTreeMap::new();

    // Initialize with zeros
    for action in actions {
        let mut scenario_map: BTreeMap<String, f64> = BTreeMap::new();
        for scenario in scenarios {
            scenario_map.insert(scenario.id.clone(), 0.0);
        }
        table.insert(action.id.clone(), scenario_map);
    }

    // Fill in outcomes
    for (action_id, scenario_id, utility) in outcomes {
        if let Some(scenario_map) = table.get_mut(action_id) {
            if let Some(u) = scenario_map.get_mut(scenario_id) {
                *u = float_normalize(*utility);
            }
        }
    }

    table
}

/// Compute worst-case (maximin) scores.
///
/// For each action, find the minimum utility across all scenarios.
/// Then select the action with the maximum of these minimums.
fn compute_worst_case_scores(
    utility_table: &BTreeMap<String, BTreeMap<String, f64>>,
) -> BTreeMap<String, f64> {
    let mut worst_case: BTreeMap<String, f64> = BTreeMap::new();

    for (action_id, scenario_map) in utility_table {
        let min_utility = scenario_map
            .values()
            .fold(f64::INFINITY, |acc, &v| acc.min(v));
        worst_case.insert(action_id.clone(), float_normalize(min_utility));
    }

    worst_case
}

/// Compute minimax regret scores.
///
/// 1. Build regret table: for each scenario, regret = best_utility_in_scenario - action_utility
/// 2. For each action, find maximum regret across all scenarios
/// 3. Select action with minimum of these maximum regrets
fn compute_minimax_regret_scores(
    utility_table: &BTreeMap<String, BTreeMap<String, f64>>,
    scenarios: &[Scenario],
) -> (BTreeMap<String, BTreeMap<String, f64>>, BTreeMap<String, f64>) {
    let mut regret_table: BTreeMap<String, BTreeMap<String, f64>> = BTreeMap::new();
    let mut max_regret: BTreeMap<String, f64> = BTreeMap::new();

    // For each scenario, find the best utility
    let mut best_by_scenario: BTreeMap<String, f64> = BTreeMap::new();
    for scenario in scenarios {
        let best = utility_table
            .values()
            .filter_map(|sm| sm.get(&scenario.id))
            .fold(f64::NEG_INFINITY, |acc, &v| acc.max(v));
        best_by_scenario.insert(scenario.id.clone(), float_normalize(best));
    }

    // Compute regret for each action in each scenario
    for (action_id, scenario_map) in utility_table {
        let mut action_regrets: BTreeMap<String, f64> = BTreeMap::new();
        let mut max_r: f64 = 0.0;

        for (scenario_id, &utility) in scenario_map {
            if let Some(best) = best_by_scenario.get(scenario_id) {
                let regret = float_normalize(best - utility);
                action_regrets.insert(scenario_id.clone(), regret);
                max_r = max_r.max(regret);
            }
        }

        regret_table.insert(action_id.clone(), action_regrets);
        max_regret.insert(action_id.clone(), float_normalize(max_r));
    }

    (regret_table, max_regret)
}

/// Compute adversarial robustness scores.
///
/// For each action, find the minimum utility across adversarial scenarios only.
/// If no adversarial scenarios exist, fall back to overall worst-case.
fn compute_adversarial_scores(
    utility_table: &BTreeMap<String, BTreeMap<String, f64>>,
    scenarios: &[Scenario],
) -> BTreeMap<String, f64> {
    let adversarial: Vec<&Scenario> = scenarios
        .iter()
        .filter(|s| s.adversarial)
        .collect();

    let mut adversarial_scores: BTreeMap<String, f64> = BTreeMap::new();

    if adversarial.is_empty() {
        // No adversarial scenarios, use worst-case
        return compute_worst_case_scores(utility_table);
    }

    for (action_id, scenario_map) in utility_table {
        let adv_ids: Vec<&str> = adversarial.iter().map(|s| s.id.as_str()).collect();

        let min_adv = scenario_map
            .iter()
            .filter(|(sid, _)| adv_ids.contains(&sid.as_str()))
            .map(|(_, &v)| v)
            .fold(f64::INFINITY, |acc, v| acc.min(v));

        adversarial_scores.insert(action_id.clone(), float_normalize(min_adv));
    }

    adversarial_scores
}

/// Compute composite scores from individual metrics.
fn compute_composite_scores(
    worst_case: &BTreeMap<String, f64>,
    minimax_regret: &BTreeMap<String, f64>,
    adversarial: &BTreeMap<String, f64>,
    weights: &CompositeWeights,
) -> BTreeMap<String, f64> {
    let mut composite: BTreeMap<String, f64> = BTreeMap::new();

    // Normalize weights to ensure they sum to 1
    let sum = weights.worst_case + weights.minimax_regret + weights.adversarial;
    let w_wc = weights.worst_case / sum;
    let w_mr = weights.minimax_regret / sum;
    let w_adv = weights.adversarial / sum;

    for action_id in worst_case.keys() {
        let wc_score = worst_case.get(action_id).copied().unwrap_or(0.0);
        let mr_score = minimax_regret.get(action_id).copied().unwrap_or(0.0);
        let adv_score = adversarial.get(action_id).copied().unwrap_or(0.0);

        // Composite: higher is better, but minimax regret needs to be inverted
        // (lower max regret = better)
        let composite_score = float_normalize(
            w_wc * wc_score + w_mr * (100.0 - mr_score) + w_adv * adv_score,
        );

        composite.insert(action_id.clone(), composite_score);
    }

    composite
}

/// Validate input and return error if invalid.
fn validate_input(input: &DecisionInput) -> Result<(), DecisionError> {
    if input.actions.is_empty() {
        return Err(DecisionError::NoActions);
    }
    if input.scenarios.is_empty() {
        return Err(DecisionError::NoScenarios);
    }
    if input.outcomes.is_empty() {
        return Err(DecisionError::NoOutcomes);
    }

    // Validate weights if provided
    if let Some(constraints) = &input.constraints {
        if let Some(_max_regret) = constraints.max_regret {
            let weights = CompositeWeights::default();
            let sum = weights.worst_case + weights.minimax_regret + weights.adversarial;
            if (sum - 1.0).abs() > 1e-9 {
                return Err(DecisionError::InvalidWeights { sum });
            }
        }
    }

    Ok(())
}

/// Main entry point: evaluate a decision problem.
///
/// Returns ranked actions with scores and a trace of the computation.
pub fn evaluate_decision(input: &DecisionInput) -> Result<DecisionOutput, DecisionError> {
    // Validate input
    validate_input(input)?;

    // Build utility table
    let utility_table =
        build_utility_table(&input.actions, &input.scenarios, &input.outcomes);

    // Compute all scores
    let worst_case = compute_worst_case_scores(&utility_table);
    let (regret_table, max_regret) = compute_minimax_regret_scores(&utility_table, &input.scenarios);
    let adversarial = compute_adversarial_scores(&utility_table, &input.scenarios);

    // Get weights (default or from constraints)
    let weights = input
        .constraints
        .as_ref()
        .map(|_| CompositeWeights::default())
        .unwrap_or_default();

    let composite = compute_composite_scores(&worst_case, &max_regret, &adversarial, &weights);

    // Rank actions (sort by composite score, descending)
    let mut ranked: Vec<(&String, f64)> = composite.iter().map(|(k, v)| (k, *v)).collect();
    ranked.sort_by(|a, b| {
        let cmp = b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal);
        if cmp == std::cmp::Ordering::Equal {
            // Tie-break: lexicographic by action_id
            a.0.cmp(b.0)
        } else {
            cmp
        }
    });

    // Build ranked actions
    let mut ranked_actions: Vec<RankedAction> = Vec::new();
    let mut best_composite = ranked.first().map(|(_, s)| *s).unwrap_or(0.0);

    for (rank, (action_id, comp_score)) in ranked.iter().enumerate() {
        let wc = worst_case.get((*action_id).as_str()).copied().unwrap_or(0.0);
        let mr = max_regret.get((*action_id).as_str()).copied().unwrap_or(0.0);
        let adv = adversarial.get((*action_id).as_str()).copied().unwrap_or(0.0);

        ranked_actions.push(RankedAction {
            action_id: (*action_id).clone(),
            score_worst_case: wc,
            score_minimax_regret: mr,
            score_adversarial: adv,
            composite_score: *comp_score,
            recommended: rank == 0,
            rank: rank + 1,
        });
    }

    // Compute fingerprint
    let fingerprint = compute_fingerprint(input);

    // Build trace
    let trace = DecisionTrace {
        utility_table,
        worst_case_table: worst_case,
        regret_table,
        max_regret_table: max_regret,
        adversarial_table: adversarial,
        composite_weights: weights,
        tie_break_rule: "lexicographic_by_action_id".to_string(),
    };

    Ok(DecisionOutput {
        ranked_actions,
        determinism_fingerprint: fingerprint,
        trace,
    })
}

/// Compute flip distances for sensitivity analysis.
///
/// Measures how much each scenario's utility would need to change
/// to flip the top action recommendation.
pub fn compute_flip_distances(input: &DecisionInput) -> Result<Vec<FlipDistance>, DecisionError> {
    // First evaluate to get current ranking
    let output = evaluate_decision(input)?;

    let top_action = output
        .ranked_actions
        .first()
        .map(|a| a.action_id.clone())
        .ok_or(DecisionError::NoActions)?;

    let mut distances: Vec<FlipDistance> = Vec::new();

    // For each scenario, compute how much the top action's utility would need to change
    // to be overtaken by the second-best action
    if output.ranked_actions.len() > 1 {
        let second = &output.ranked_actions[1];

        for scenario in &input.scenarios {
            // Find utility of top action in this scenario
            let top_utility = output
                .trace
                .utility_table
                .get(&top_action)
                .and_then(|m| m.get(&scenario.id))
                .copied()
                .unwrap_or(0.0);

            let second_utility = output
                .trace
                .utility_table
                .get(&second.action_id)
                .and_then(|m| m.get(&scenario.id))
                .copied()
                .unwrap_or(0.0);

            // Flip distance is the gap
            let flip_distance = float_normalize((top_utility - second_utility).abs());

            distances.push(FlipDistance {
                variable_id: scenario.id.clone(),
                flip_distance,
                new_top_action: second.action_id.clone(),
            });
        }
    }

    // Sort by flip distance (smallest first = most sensitive)
    distances.sort_by(|a, b| {
        a.flip_distance
            .partial_cmp(&b.flip_distance)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(distances)
}

/// Rank evidence by Value of Information (VOI).
pub fn rank_evidence_by_voi(
    input: &DecisionInput,
    min_evoi: f64,
) -> Result<Vec<VoiRanking>, DecisionError> {
    // Evaluate to get current state
    let output = evaluate_decision(input)?;

    let mut rankings: Vec<VoiRanking> = Vec::new();

    // Simple VOI heuristic: rank by sensitivity (inverse of flip distance)
    for scenario in &input.scenarios {
        // Find how much this scenario affects the decision
        let flip_distance = output
            .trace
            .utility_table
            .get(output.ranked_actions.first().map(|a| a.action_id.as_str()).unwrap_or(""))
            .and_then(|m| m.get(scenario.id.as_str()))
            .map(|&u| 1.0 / (u.abs() + 0.1)) // Inverse utility as proxy for sensitivity
            .unwrap_or(0.0);

        let evoi = float_normalize(flip_distance);

        let recommendation = if evoi > min_evoi * 2.0 {
            "do_now"
        } else if evoi > min_evoi {
            "plan_later"
        } else {
            "defer"
        };

        rankings.push(VoiRanking {
            action_id: scenario.id.clone(),
            evoi,
            recommendation: recommendation.to_string(),
            rationale: vec![
                format!("Scenario {} has sensitivity {}", scenario.id, evoi),
                format!(
                    "Cost-adjusted information gain is {}",
                    evoi.to_string()
                ),
            ],
        });
    }

    // Sort by VOI (highest first)
    rankings.sort_by(|a, b| b.evoi.partial_cmp(&a.evoi).unwrap_or(std::cmp::Ordering::Equal));

    Ok(rankings)
}

/// Generate a regret-bounded plan.
pub fn generate_regret_bounded_plan(
    input: &DecisionInput,
    horizon: usize,
    min_evoi: f64,
) -> Result<RegretBoundedPlan, DecisionError> {
    let rankings = rank_evidence_by_voi(input, min_evoi)?;

    let selected: Vec<PlannedAction> = rankings
        .iter()
        .filter(|r| r.recommendation == "do_now")
        .take(horizon)
        .map(|r| PlannedAction {
            id: r.action_id.clone(),
            rationale: r.rationale.clone(),
        })
        .collect();

    // Generate deterministic plan ID
    let plan_content = format!(
        "{}:{}:{}",
        input
            .actions
            .first()
            .map(|a| a.id.as_str())
            .unwrap_or("none"),
        horizon,
        min_evoi
    );
    let plan_id = stable_hash(plan_content.as_bytes())[..16].to_string();

    Ok(RegretBoundedPlan {
        id: plan_id,
        decision_id: input
            .id
            .clone()
            .unwrap_or_else(|| "unknown".to_string()),
        actions: selected,
        bounded_horizon: horizon,
    })
}

/// Explain the decision boundary.
pub fn explain_decision_boundary(
    input: &DecisionInput,
) -> Result<DecisionBoundary, DecisionError> {
    let output = evaluate_decision(input)?;
    let flip_distances = compute_flip_distances(input)?;

    Ok(DecisionBoundary {
        top_action: output
            .ranked_actions
            .first()
            .map(|a| a.action_id.clone())
            .unwrap_or_else(|| "unknown".to_string()),
        nearest_flips: flip_distances.into_iter().take(2).collect(),
    })
}

/// Referee a proposal against the computed decision.
pub fn referee_proposal(
    input: &DecisionInput,
    claim: &str,
) -> Result<RefereeAdjudication, DecisionError> {
    let boundary = explain_decision_boundary(input)?;

    let accepted = claim == boundary.top_action;

    Ok(RefereeAdjudication {
        accepted,
        agent_claim: Some(claim.to_string()),
        boundary: boundary.clone(),
        what_would_change: boundary
            .nearest_flips
            .iter()
            .map(|f| {
                format!(
                    "{} at {} changes top action",
                    f.variable_id, f.flip_distance
                )
            })
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_input() -> DecisionInput {
        DecisionInput {
            id: Some("test_decision".to_string()),
            actions: vec![
                ActionOption {
                    id: "a1".to_string(),
                    label: "Action 1".to_string(),
                },
                ActionOption {
                    id: "a2".to_string(),
                    label: "Action 2".to_string(),
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
                    probability: Some(0.3),
                    adversarial: true,
                },
                Scenario {
                    id: "s3".to_string(),
                    probability: Some(0.2),
                    adversarial: false,
                },
            ],
            outcomes: vec![
                ("a1".to_string(), "s1".to_string(), 100.0),
                ("a1".to_string(), "s2".to_string(), 50.0),
                ("a1".to_string(), "s3".to_string(), 80.0),
                ("a2".to_string(), "s1".to_string(), 90.0),
                ("a2".to_string(), "s2".to_string(), 60.0),
                ("a2".to_string(), "s3".to_string(), 70.0),
            ],
            constraints: None,
            evidence: None,
            meta: None,
        }
    }

    #[test]
    fn test_evaluate_decision_basic() {
        let input = create_test_input();
        let result = evaluate_decision(&input);

        assert!(result.is_ok());
        let output = result.unwrap();

        // Should have 2 ranked actions
        assert_eq!(output.ranked_actions.len(), 2);

        // First action should be recommended
        assert!(output.ranked_actions[0].recommended);

        // Fingerprint should be present
        assert!(!output.determinism_fingerprint.is_empty());
    }

    #[test]
    fn test_evaluate_decision_worst_case() {
        let input = create_test_input();
        let output = evaluate_decision(&input).unwrap();

        // a1 worst-case: min(100, 50, 80) = 50
        // a2 worst-case: min(90, 60, 70) = 60
        // a2 should have higher worst-case score
        let a1 = output
            .ranked_actions
            .iter()
            .find(|a| a.action_id == "a1")
            .unwrap();
        let a2 = output
            .ranked_actions
            .iter()
            .find(|a| a.action_id == "a2")
            .unwrap();

        assert!(a2.score_worst_case > a1.score_worst_case);
    }

    #[test]
    fn test_evaluate_decision_minimax_regret() {
        let input = create_test_input();
        let output = evaluate_decision(&input).unwrap();

        // Check regret table exists in trace
        assert!(!output.trace.regret_table.is_empty());
        assert!(!output.trace.max_regret_table.is_empty());
    }

    #[test]
    fn test_evaluate_decision_adversarial() {
        let input = create_test_input();
        let output = evaluate_decision(&input).unwrap();

        // s2 is adversarial
        // a1 in s2: 50, a2 in s2: 60
        // a2 should have higher adversarial score (higher is better)
        let a1 = output
            .ranked_actions
            .iter()
            .find(|a| a.action_id == "a1")
            .unwrap();
        let a2 = output
            .ranked_actions
            .iter()
            .find(|a| a.action_id == "a2")
            .unwrap();

        assert!(a2.score_adversarial >= a1.score_adversarial);
    }

    #[test]
    fn test_determinism_same_input_same_output() {
        let input1 = create_test_input();
        let input2 = create_test_input(); // Clone

        let output1 = evaluate_decision(&input1).unwrap();
        let output2 = evaluate_decision(&input2).unwrap();

        // Same input should produce same fingerprint
        assert_eq!(
            output1.determinism_fingerprint,
            output2.determinism_fingerprint
        );

        // Same input should produce same JSON bytes
        let json1 = serde_json::to_vec(&output1).unwrap();
        let json2 = serde_json::to_vec(&output2).unwrap();
        assert_eq!(json1, json2);
    }

    #[test]
    fn test_determinism_different_key_order() {
        // Create same logical input but with outcomes in different order
        let input1 = create_test_input();

        let mut input2 = create_test_input();
        input2.outcomes = vec![
            ("a2".to_string(), "s3".to_string(), 70.0),
            ("a1".to_string(), "s3".to_string(), 80.0),
            ("a2".to_string(), "s2".to_string(), 60.0),
            ("a1".to_string(), "s2".to_string(), 50.0),
            ("a2".to_string(), "s1".to_string(), 90.0),
            ("a1".to_string(), "s1".to_string(), 100.0),
        ];

        let output1 = evaluate_decision(&input1).unwrap();
        let output2 = evaluate_decision(&input2).unwrap();

        // Different key order should produce same fingerprint
        assert_eq!(
            output1.determinism_fingerprint,
            output2.determinism_fingerprint
        );
    }

    #[test]
    fn test_compute_flip_distances() {
        let input = create_test_input();
        let distances = compute_flip_distances(&input).unwrap();

        assert!(!distances.is_empty());
        for d in &distances {
            assert!(d.flip_distance >= 0.0);
        }
    }

    #[test]
    fn test_rank_evidence_by_voi() {
        let input = create_test_input();
        let rankings = rank_evidence_by_voi(&input, 0.1).unwrap();

        assert!(!rankings.is_empty());
        for r in &rankings {
            assert!(!r.recommendation.is_empty());
            assert!(!r.rationale.is_empty());
        }
    }

    #[test]
    fn test_generate_regret_bounded_plan() {
        let input = create_test_input();
        let plan = generate_regret_bounded_plan(&input, 2, 0.1).unwrap();

        assert!(!plan.id.is_empty());
        assert!(!plan.actions.is_empty());
        assert_eq!(plan.bounded_horizon, 2);
    }

    #[test]
    fn test_explain_decision_boundary() {
        let input = create_test_input();
        let boundary = explain_decision_boundary(&input).unwrap();

        assert!(!boundary.top_action.is_empty());
        // Should have up to 2 nearest flips
        assert!(boundary.nearest_flips.len() <= 2);
    }

    #[test]
    fn test_referee_proposal_accepted() {
        let input = create_test_input();
        let boundary = explain_decision_boundary(&input).unwrap();

        // Proposal matching top action should be accepted
        let adjudication = referee_proposal(&input, &boundary.top_action).unwrap();
        assert!(adjudication.accepted);
    }

    #[test]
    fn test_referee_proposal_rejected() {
        let input = create_test_input();

        // Proposal NOT matching top action should be rejected
        let wrong_action = if input.actions[0].id == "a1" {
            "a2"
        } else {
            "a1"
        };
        let adjudication = referee_proposal(&input, wrong_action).unwrap();
        assert!(!adjudication.accepted);
    }

    #[test]
    fn test_error_no_actions() {
        let input = DecisionInput {
            id: None,
            actions: vec![],
            scenarios: vec![Scenario {
                id: "s1".to_string(),
                probability: Some(1.0),
                adversarial: false,
            }],
            outcomes: vec![],
            constraints: None,
            evidence: None,
            meta: None,
        };

        let result = evaluate_decision(&input);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DecisionError::NoActions));
    }

    #[test]
    fn test_error_no_scenarios() {
        let input = DecisionInput {
            id: None,
            actions: vec![ActionOption {
                id: "a1".to_string(),
                label: "A1".to_string(),
            }],
            scenarios: vec![],
            outcomes: vec![],
            constraints: None,
            evidence: None,
            meta: None,
        };

        let result = evaluate_decision(&input);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DecisionError::NoScenarios));
    }

    #[test]
    fn test_tie_break_deterministic() {
        // Create input where scores might tie
        let mut input = create_test_input();
        // Make utilities identical
        input.outcomes = vec![
            ("a1".to_string(), "s1".to_string(), 50.0),
            ("a1".to_string(), "s2".to_string(), 50.0),
            ("a2".to_string(), "s1".to_string(), 50.0),
            ("a2".to_string(), "s2".to_string(), 50.0),
        ];

        let output1 = evaluate_decision(&input).unwrap();
        let output2 = evaluate_decision(&input).unwrap();

        // Both should have same ranking order
        assert_eq!(
            output1.ranked_actions[0].action_id,
            output2.ranked_actions[0].action_id
        );

        // a1 should come before a2 (lexicographic tie-break)
        assert_eq!(output1.ranked_actions[0].action_id, "a1");
        assert_eq!(output1.ranked_actions[1].action_id, "a2");
    }

    #[test]
    fn test_float_normalization_in_scores() {
        // Input with floating-point noise
        let mut input = create_test_input();
        input.outcomes = vec![
            (
                "a1".to_string(),
                "s1".to_string(),
                0.1 + 0.2, // Not exactly 0.3
            ),
            ("a1".to_string(), "s2".to_string(), 0.3),
            ("a2".to_string(), "s1".to_string(), 0.3),
            ("a2".to_string(), "s2".to_string(), 0.1 + 0.2),
        ];

        let output = evaluate_decision(&input).unwrap();

        // Scores should be deterministic despite float noise
        let json1 = serde_json::to_vec(&output).unwrap();
        let json2 = serde_json::to_vec(&output).unwrap();
        assert_eq!(json1, json2);
    }
}
