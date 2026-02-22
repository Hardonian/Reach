//! Decision engine algorithms for robust decision-making under uncertainty.
//!
//! This module implements the core quant decision primitives:
//! - **Worst-case (Maximin)**: Maximize the minimum utility across scenarios
//! - **Minimax Regret**: Minimize the maximum regret across scenarios
//! - **Adversarial Robustness**: Worst-case over adversarial scenario subset

use crate::determinism::{canonical_json, compute_fingerprint, float_normalize};
use crate::types::*;
use std::collections::BTreeMap;

/// Error type for decision engine operations.
#[derive(Debug, Clone, thiserror::Error)]
pub enum DecisionError {
    #[error("No actions provided")]
    NoActions,
    #[error("No scenarios provided")]
    NoScenarios,
    #[error("Missing outcome for action '{action}' in scenario '{scenario}'")]
    MissingOutcome { action: String, scenario: String },
    #[error("Invalid probability distribution: sum = {sum}")]
    InvalidProbabilities { sum: f64 },
}

/// Build the utility table from outcomes.
///
/// Returns a map: action_id -> scenario_id -> utility.
fn build_utility_table(
    actions: &[ActionOption],
    scenarios: &[Scenario],
    outcomes: &[(String, String, f64)],
) -> Result<BTreeMap<String, BTreeMap<String, f64>>, DecisionError> {
    let mut table: BTreeMap<String, BTreeMap<String, f64>> = BTreeMap::new();

    // Initialize all action-scenario pairs
    for action in actions {
        let mut scenario_map: BTreeMap<String, f64> = BTreeMap::new();
        for scenario in scenarios {
            scenario_map.insert(scenario.id.clone(), 0.0);
        }
        table.insert(action.id.clone(), scenario_map);
    }

    // Fill in outcomes
    for (action_id, scenario_id, utility) in outcomes {
        let action_entry = table.get_mut(action_id).ok_or_else(|| DecisionError::MissingOutcome {
            action: action_id.clone(),
            scenario: scenario_id.clone(),
        })?;
        if !action_entry.contains_key(scenario_id) {
            return Err(DecisionError::MissingOutcome {
                action: action_id.clone(),
                scenario: scenario_id.clone(),
            });
        }
        action_entry.insert(scenario_id.clone(), float_normalize(*utility));
    }

    Ok(table)
}

/// Compute worst-case (minimum) utility for each action across all scenarios.
///
/// Returns a map: action_id -> minimum utility.
fn compute_worst_case(
    utility_table: &BTreeMap<String, BTreeMap<String, f64>>,
) -> BTreeMap<String, f64> {
    let mut result: BTreeMap<String, f64> = BTreeMap::new();

    for (action_id, scenarios) in utility_table {
        let min_utility = scenarios.values().copied().fold(f64::INFINITY, f64::min);
        result.insert(action_id.clone(), float_normalize(min_utility));
    }

    result
}

/// Compute worst-case utility over adversarial scenarios only.
///
/// If no adversarial scenarios exist, returns the same as worst_case.
fn compute_adversarial_worst_case(
    utility_table: &BTreeMap<String, BTreeMap<String, f64>>,
    scenarios: &[Scenario],
) -> BTreeMap<String, f64> {
    let adversarial_ids: std::collections::HashSet<&str> = scenarios
        .iter()
        .filter(|s| s.adversarial)
        .map(|s| s.id.as_str())
        .collect();

    let mut result: BTreeMap<String, f64> = BTreeMap::new();

    for (action_id, scenario_utilities) in utility_table {
        let min_utility = if adversarial_ids.is_empty() {
            // No adversarial scenarios, use all scenarios
            scenario_utilities.values().copied().fold(f64::INFINITY, f64::min)
        } else {
            // Use only adversarial scenarios
            scenario_utilities
                .iter()
                .filter(|(id, _)| adversarial_ids.contains(id.as_str()))
                .map(|(_, &u)| u)
                .fold(f64::INFINITY, f64::min)
        };
        result.insert(action_id.clone(), float_normalize(min_utility));
    }

    result
}

/// Compute the regret table.
///
/// Regret for action a in scenario s = max_utility(s) - utility(a, s)
/// Returns a map: action_id -> scenario_id -> regret.
fn compute_regret_table(
    utility_table: &BTreeMap<String, BTreeMap<String, f64>>,
    scenarios: &[Scenario],
) -> BTreeMap<String, BTreeMap<String, f64>> {
    // First, compute max utility per scenario
    let mut max_per_scenario: BTreeMap<String, f64> = BTreeMap::new();
    for scenario in scenarios {
        let max = utility_table
            .values()
            .filter_map(|s| s.get(&scenario.id))
            .copied()
            .fold(f64::NEG_INFINITY, f64::max);
        max_per_scenario.insert(scenario.id.clone(), float_normalize(max));
    }

    // Compute regret for each action-scenario pair
    let mut regret_table: BTreeMap<String, BTreeMap<String, f64>> = BTreeMap::new();

    for (action_id, scenario_utilities) in utility_table {
        let mut action_regrets: BTreeMap<String, f64> = BTreeMap::new();
        for (scenario_id, &utility) in scenario_utilities {
            let max_utility = max_per_scenario.get(scenario_id).copied().unwrap_or(0.0);
            let regret = float_normalize(max_utility - utility);
            action_regrets.insert(scenario_id.clone(), regret);
        }
        regret_table.insert(action_id.clone(), action_regrets);
    }

    regret_table
}

/// Compute maximum regret for each action.
///
/// Returns a map: action_id -> maximum regret.
fn compute_max_regret(
    regret_table: &BTreeMap<String, BTreeMap<String, f64>>,
) -> BTreeMap<String, f64> {
    let mut result: BTreeMap<String, f64> = BTreeMap::new();

    for (action_id, scenario_regrets) in regret_table {
        let max_regret = scenario_regrets.values().copied().fold(0.0, f64::max);
        result.insert(action_id.clone(), float_normalize(max_regret));
    }

    result
}

/// Normalize a value to [0, 1] range given min and max bounds.
fn normalize_to_range(value: f64, min_val: f64, max_val: f64) -> f64 {
    if (max_val - min_val).abs() < 1e-12 {
        return 1.0; // All values are the same
    }
    float_normalize((value - min_val) / (max_val - min_val))
}

/// Evaluate a decision and return ranked actions with scores.
///
/// This is the main entry point for decision evaluation. It computes:
/// 1. Worst-case utility for each action (maximin criterion)
/// 2. Maximum regret for each action (minimax regret criterion)
/// 3. Adversarial robustness score (worst-case over adversarial subset)
/// 4. Composite score (weighted combination)
///
/// Actions are ranked by composite score, with ties broken lexicographically by action ID.
///
/// # Example
///
/// ```
/// use decision_engine::types::{DecisionInput, ActionOption, Scenario};
/// use decision_engine::engine::evaluate_decision;
///
/// let input = DecisionInput {
///     id: Some("test".to_string()),
///     actions: vec![
///         ActionOption { id: "a1".to_string(), label: "Action 1".to_string() },
///         ActionOption { id: "a2".to_string(), label: "Action 2".to_string() },
///     ],
///     scenarios: vec![
///         Scenario { id: "s1".to_string(), probability: Some(0.5), adversarial: false },
///         Scenario { id: "s2".to_string(), probability: Some(0.5), adversarial: true },
///     ],
///     outcomes: vec![
///         ("a1".to_string(), "s1".to_string(), 100.0),
///         ("a1".to_string(), "s2".to_string(), 20.0),
///         ("a2".to_string(), "s1".to_string(), 60.0),
///         ("a2".to_string(), "s2".to_string(), 60.0),
///     ],
///     constraints: None,
///     evidence: None,
///     meta: None,
/// };
///
/// let output = evaluate_decision(input).unwrap();
/// assert!(!output.ranked_actions.is_empty());
/// assert_eq!(output.determinism_fingerprint.len(), 64);
/// ```
pub fn evaluate_decision(input: DecisionInput) -> Result<DecisionOutput, DecisionError> {
    // Validate input
    if input.actions.is_empty() {
        return Err(DecisionError::NoActions);
    }
    if input.scenarios.is_empty() {
        return Err(DecisionError::NoScenarios);
    }

    // Build utility table
    let utility_table = build_utility_table(&input.actions, &input.scenarios, &input.outcomes)?;

    // Compute worst-case utilities
    let worst_case_table = compute_worst_case(&utility_table);

    // Compute regret table and max regrets
    let regret_table = compute_regret_table(&utility_table, &input.scenarios);
    let max_regret_table = compute_max_regret(&regret_table);

    // Compute adversarial worst-case
    let adversarial_table = compute_adversarial_worst_case(&utility_table, &input.scenarios);

    // Get bounds for normalization
    let wc_values: Vec<f64> = worst_case_table.values().copied().collect();
    let wc_min = wc_values.iter().copied().fold(f64::INFINITY, f64::min);
    let wc_max = wc_values.iter().copied().fold(f64::NEG_INFINITY, f64::max);

    let mr_values: Vec<f64> = max_regret_table.values().copied().collect();
    let mr_min = mr_values.iter().copied().fold(f64::INFINITY, f64::min);
    let mr_max = mr_values.iter().copied().fold(f64::NEG_INFINITY, f64::max);

    let adv_values: Vec<f64> = adversarial_table.values().copied().collect();
    let adv_min = adv_values.iter().copied().fold(f64::INFINITY, f64::min);
    let adv_max = adv_values.iter().copied().fold(f64::NEG_INFINITY, f64::max);

    // Use default weights
    let weights = CompositeWeights::default();

    // Compute composite scores and rank actions
    let mut ranked: Vec<RankedAction> = input
        .actions
        .iter()
        .map(|action| {
            let action_id = &action.id;

            let score_worst_case = worst_case_table.get(action_id).copied().unwrap_or(0.0);
            let score_minimax_regret = max_regret_table.get(action_id).copied().unwrap_or(0.0);
            let score_adversarial = adversarial_table.get(action_id).copied().unwrap_or(0.0);

            // Normalize scores to [0, 1]
            // For worst-case and adversarial: higher is better
            let normalized_wc = normalize_to_range(score_worst_case, wc_min, wc_max);
            // For regret: lower is better, so invert
            let normalized_mr = 1.0 - normalize_to_range(score_minimax_regret, mr_min, mr_max);
            // For adversarial: higher is better
            let normalized_adv = normalize_to_range(score_adversarial, adv_min, adv_max);

            // Compute composite score
            let composite_score = float_normalize(
                weights.worst_case * normalized_wc
                    + weights.minimax_regret * normalized_mr
                    + weights.adversarial * normalized_adv,
            );

            RankedAction {
                action_id: action_id.clone(),
                score_worst_case,
                score_minimax_regret,
                score_adversarial,
                composite_score,
                recommended: false, // Set after sorting
                rank: 0,            // Set after sorting
            }
        })
        .collect();

    // Sort by composite score (descending), then by action_id (ascending) for tie-breaking
    ranked.sort_by(|a, b| {
        let score_cmp = b.composite_score.partial_cmp(&a.composite_score).unwrap_or(std::cmp::Ordering::Equal);
        if score_cmp != std::cmp::Ordering::Equal {
            score_cmp
        } else {
            a.action_id.cmp(&b.action_id)
        }
    });

    // Assign ranks and mark recommended action
    for (i, action) in ranked.iter_mut().enumerate() {
        action.rank = i + 1;
        if i == 0 {
            action.recommended = true;
        }
    }

    // Compute fingerprint
    let fingerprint = compute_fingerprint(&input);

    // Build trace
    let trace = DecisionTrace {
        utility_table,
        worst_case_table,
        regret_table,
        max_regret_table,
        adversarial_table,
        composite_weights: weights,
        tie_break_rule: "lexicographic_by_action_id".to_string(),
    };

    Ok(DecisionOutput {
        ranked_actions: ranked,
        determinism_fingerprint: fingerprint,
        trace,
    })
}

/// Compute flip distances for sensitivity analysis.
///
/// Returns the distance (magnitude of change) needed for each variable
/// to flip the decision ranking.
pub fn compute_flip_distances(
    input: &DecisionInput,
    output: &DecisionOutput,
) -> Vec<FlipDistance> {
    // Get current top action
    let top_action = output.recommended_action_id().unwrap_or("");

    // For each scenario, compute how much utilities would need to change
    // to flip the top action
    let mut flip_distances: Vec<FlipDistance> = Vec::new();

    for scenario in &input.scenarios {
        // Get current utilities for top action in this scenario
        let top_utility = output
            .trace
            .utility_table
            .get(top_action)
            .and_then(|s| s.get(&scenario.id))
            .copied()
            .unwrap_or(0.0);

        // Find the action that would become top if this scenario's utilities changed
        let mut best_alternative: Option<(String, f64)> = None;

        for action in &input.actions {
            if action.id == top_action {
                continue;
            }
            let alt_utility = output
                .trace
                .utility_table
                .get(&action.id)
                .and_then(|s| s.get(&scenario.id))
                .copied()
                .unwrap_or(0.0);

            // Compute flip distance: how much alt_utility needs to increase
            // or top_utility needs to decrease for alt to win
            let distance = float_normalize((top_utility - alt_utility).abs() / 100.0); // Normalize to [0, 1] range

            if best_alternative.is_none() || distance < best_alternative.as_ref().unwrap().1 {
                best_alternative = Some((action.id.clone(), distance));
            }
        }

        if let Some((new_top, distance)) = best_alternative {
            flip_distances.push(FlipDistance {
                variable_id: scenario.id.clone(),
                flip_distance: distance,
                new_top_action: new_top,
            });
        }
    }

    // Sort by flip distance (ascending)
    flip_distances.sort_by(|a, b| {
        a.flip_distance
            .partial_cmp(&b.flip_distance)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.variable_id.cmp(&b.variable_id))
    });

    flip_distances
}

/// Rank evidence by Value of Information (VOI).
///
/// Returns a list of evidence actions ranked by expected information gain.
pub fn rank_evidence_by_voi(
    input: &DecisionInput,
    output: &DecisionOutput,
    min_evoi: f64,
) -> Vec<VoiRanking> {
    let flip_distances = compute_flip_distances(input, output);

    let mut rankings: Vec<VoiRanking> = flip_distances
        .iter()
        .enumerate()
        .map(|(idx, fd)| {
            // Higher flip distance = more stable = lower VOI
            // Lower flip distance = more sensitive = higher VOI
            let evoi = float_normalize(1.0 / (idx as f64 + 1.0 + fd.flip_distance));

            let recommendation = if evoi > min_evoi * 2.0 {
                "do_now"
            } else if evoi > min_evoi {
                "plan_later"
            } else {
                "defer"
            };

            VoiRanking {
                action_id: format!("evidence_{}", fd.variable_id),
                evoi,
                recommendation: recommendation.to_string(),
                rationale: vec![
                    format!(
                        "Variable {} has flip distance {:.4}",
                        fd.variable_id, fd.flip_distance
                    ),
                    format!("Expected VOI is {:.4}", evoi),
                ],
            }
        })
        .collect();

    // Sort by evoi descending
    rankings.sort_by(|a, b| {
        b.evoi
            .partial_cmp(&a.evoi)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.action_id.cmp(&b.action_id))
    });

    rankings
}

/// Generate a regret-bounded plan.
///
/// Creates a plan with bounded horizon, selecting actions that maximize
/// expected value of information while maintaining monotonic improvement.
pub fn generate_regret_bounded_plan(
    input: &DecisionInput,
    output: &DecisionOutput,
    horizon: usize,
    min_evoi: f64,
) -> RegretBoundedPlan {
    let rankings = rank_evidence_by_voi(input, output, min_evoi);

    // Select top actions up to horizon
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
    let plan_id = compute_fingerprint(&(input.id.as_deref().unwrap_or(""), horizon, min_evoi));

    RegretBoundedPlan {
        id: plan_id,
        decision_id: input.id.clone().unwrap_or_default(),
        actions: selected,
        bounded_horizon: horizon,
    }
}

/// Explain the decision boundary.
///
/// Returns the current top action and nearest flip distances.
pub fn explain_decision_boundary(
    input: &DecisionInput,
    output: &DecisionOutput,
) -> DecisionBoundary {
    let flip_distances = compute_flip_distances(input, output);
    let top_action = output.recommended_action_id().unwrap_or("").to_string();

    DecisionBoundary {
        top_action,
        nearest_flips: flip_distances.into_iter().take(2).collect(),
    }
}

/// Adjudicate a proposal against the computed decision boundary.
///
/// Returns whether the proposal is accepted and what would need to change.
pub fn referee_proposal(
    input: &DecisionInput,
    output: &DecisionOutput,
    proposal_claim: Option<&str>,
) -> RefereeAdjudication {
    let boundary = explain_decision_boundary(input, output);

    let accepted = proposal_claim == Some(&boundary.top_action);

    let what_would_change = if !accepted {
        vec![
            format!(
                "Agent claim '{}' differs from computed top action '{}'",
                proposal_claim.unwrap_or("none"),
                boundary.top_action
            ),
            format!(
                "Nearest flip: {} at distance {:.4}",
                boundary.nearest_flips.first().map(|f| f.variable_id.as_str()).unwrap_or("none"),
                boundary.nearest_flips.first().map(|f| f.flip_distance).unwrap_or(0.0)
            ),
        ]
    } else {
        vec!["Proposal matches computed decision boundary".to_string()]
    };

    RefereeAdjudication {
        accepted,
        agent_claim: proposal_claim.map(|s| s.to_string()),
        boundary,
        what_would_change,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_input() -> DecisionInput {
        DecisionInput {
            id: Some("test_decision".to_string()),
            actions: vec![
                ActionOption {
                    id: "verify_terms".to_string(),
                    label: "Verify Terms".to_string(),
                },
                ActionOption {
                    id: "commit_now".to_string(),
                    label: "Commit Now".to_string(),
                },
            ],
            scenarios: vec![
                Scenario {
                    id: "favorable".to_string(),
                    probability: Some(0.5),
                    adversarial: false,
                },
                Scenario {
                    id: "unfavorable".to_string(),
                    probability: Some(0.5),
                    adversarial: true,
                },
            ],
            outcomes: vec![
                ("verify_terms".to_string(), "favorable".to_string(), 80.0),
                ("verify_terms".to_string(), "unfavorable".to_string(), 60.0),
                ("commit_now".to_string(), "favorable".to_string(), 100.0),
                ("commit_now".to_string(), "unfavorable".to_string(), 20.0),
            ],
            constraints: None,
            evidence: None,
            meta: None,
        }
    }

    #[test]
    fn test_evaluate_decision_basic() {
        let input = make_test_input();
        let output = evaluate_decision(input).unwrap();

        assert_eq!(output.ranked_actions.len(), 2);
        assert!(output.ranked_actions[0].recommended);
        assert!(!output.ranked_actions[1].recommended);
        assert_eq!(output.ranked_actions[0].rank, 1);
        assert_eq!(output.ranked_actions[1].rank, 2);
    }

    #[test]
    fn test_evaluate_decision_determinism() {
        let input = make_test_input();

        // Run twice with same input
        let output1 = evaluate_decision(input.clone()).unwrap();
        let output2 = evaluate_decision(input).unwrap();

        // Fingerprints should be identical
        assert_eq!(output1.determinism_fingerprint, output2.determinism_fingerprint);

        // Rankings should be identical
        assert_eq!(output1.ranked_actions.len(), output2.ranked_actions.len());
        for (a, b) in output1.ranked_actions.iter().zip(output2.ranked_actions.iter()) {
            assert_eq!(a.action_id, b.action_id);
            assert_eq!(a.rank, b.rank);
            assert_eq!(a.recommended, b.recommended);
        }
    }

    #[test]
    fn test_worst_case_computation() {
        let input = make_test_input();
        let output = evaluate_decision(input).unwrap();

        // verify_terms: min(80, 60) = 60
        // commit_now: min(100, 20) = 20
        let verify_wc = output.trace.worst_case_table.get("verify_terms").copied().unwrap();
        let commit_wc = output.trace.worst_case_table.get("commit_now").copied().unwrap();

        assert!((verify_wc - 60.0).abs() < 1e-9);
        assert!((commit_wc - 20.0).abs() < 1e-9);
    }

    #[test]
    fn test_regret_computation() {
        let input = make_test_input();
        let output = evaluate_decision(input).unwrap();

        // Max per scenario:
        // favorable: max(80, 100) = 100
        // unfavorable: max(60, 20) = 60

        // Regret for verify_terms:
        // favorable: 100 - 80 = 20
        // unfavorable: 60 - 60 = 0
        // max regret = 20

        // Regret for commit_now:
        // favorable: 100 - 100 = 0
        // unfavorable: 60 - 20 = 40
        // max regret = 40

        let verify_mr = output.trace.max_regret_table.get("verify_terms").copied().unwrap();
        let commit_mr = output.trace.max_regret_table.get("commit_now").copied().unwrap();

        assert!((verify_mr - 20.0).abs() < 1e-9);
        assert!((commit_mr - 40.0).abs() < 1e-9);
    }

    #[test]
    fn test_adversarial_computation() {
        let input = make_test_input();
        let output = evaluate_decision(input).unwrap();

        // Only "unfavorable" is adversarial
        // verify_terms: 60
        // commit_now: 20

        let verify_adv = output.trace.adversarial_table.get("verify_terms").copied().unwrap();
        let commit_adv = output.trace.adversarial_table.get("commit_now").copied().unwrap();

        assert!((verify_adv - 60.0).abs() < 1e-9);
        assert!((commit_adv - 20.0).abs() < 1e-9);
    }

    #[test]
    fn test_tie_breaking() {
        // Create input where both actions have identical scores
        let input = DecisionInput {
            id: Some("tie_test".to_string()),
            actions: vec![
                ActionOption {
                    id: "b_action".to_string(),
                    label: "B".to_string(),
                },
                ActionOption {
                    id: "a_action".to_string(),
                    label: "A".to_string(),
                },
            ],
            scenarios: vec![Scenario {
                id: "s1".to_string(),
                probability: Some(1.0),
                adversarial: false,
            }],
            outcomes: vec![
                ("b_action".to_string(), "s1".to_string(), 50.0),
                ("a_action".to_string(), "s1".to_string(), 50.0),
            ],
            constraints: None,
            evidence: None,
            meta: None,
        };

        let output = evaluate_decision(input).unwrap();

        // a_action should win due to lexicographic tie-breaking
        assert_eq!(output.ranked_actions[0].action_id, "a_action");
        assert!(output.ranked_actions[0].recommended);
    }

    #[test]
    fn test_no_actions_error() {
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

        let result = evaluate_decision(input);
        assert!(matches!(result, Err(DecisionError::NoActions)));
    }

    #[test]
    fn test_no_scenarios_error() {
        let input = DecisionInput {
            id: None,
            actions: vec![ActionOption {
                id: "a1".to_string(),
                label: "A".to_string(),
            }],
            scenarios: vec![],
            outcomes: vec![],
            constraints: None,
            evidence: None,
            meta: None,
        };

        let result = evaluate_decision(input);
        assert!(matches!(result, Err(DecisionError::NoScenarios)));
    }

    #[test]
    fn test_flip_distances() {
        let input = make_test_input();
        let output = evaluate_decision(input.clone()).unwrap();
        let flips = compute_flip_distances(&input, &output);

        assert!(!flips.is_empty());
        // Should be sorted by flip distance
        for i in 1..flips.len() {
            assert!(flips[i - 1].flip_distance <= flips[i].flip_distance);
        }
    }

    #[test]
    fn test_voi_ranking() {
        let input = make_test_input();
        let output = evaluate_decision(input.clone()).unwrap();
        let rankings = rank_evidence_by_voi(&input, &output, 0.1);

        assert!(!rankings.is_empty());
        // Should be sorted by evoi descending
        for i in 1..rankings.len() {
            assert!(rankings[i - 1].evoi >= rankings[i].evoi);
        }
    }

    #[test]
    fn test_regret_bounded_plan() {
        let input = make_test_input();
        let output = evaluate_decision(input.clone()).unwrap();
        let plan = generate_regret_bounded_plan(&input, &output, 3, 0.1);

        assert!(plan.actions.len() <= 3);
        assert_eq!(plan.bounded_horizon, 3);
    }

    #[test]
    fn test_decision_boundary() {
        let input = make_test_input();
        let output = evaluate_decision(input.clone()).unwrap();
        let boundary = explain_decision_boundary(&input, &output);

        assert!(!boundary.top_action.is_empty());
        assert!(boundary.nearest_flips.len() <= 2);
    }

    #[test]
    fn test_referee_proposal_accepted() {
        let input = make_test_input();
        let output = evaluate_decision(input.clone()).unwrap();
        let top_action = output.recommended_action_id().unwrap();

        let adjudication = referee_proposal(&input, &output, Some(top_action));

        assert!(adjudication.accepted);
    }

    #[test]
    fn test_referee_proposal_rejected() {
        let input = make_test_input();
        let output = evaluate_decision(input.clone()).unwrap();

        let adjudication = referee_proposal(&input, &output, Some("wrong_action"));

        assert!(!adjudication.accepted);
    }
}
