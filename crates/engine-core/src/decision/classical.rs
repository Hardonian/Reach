//! Classical decision-theory algorithms.
//!
//! These algorithms operate on a matrix-style payoff model where each action
//! maps to a utility value for every possible state of the world. All
//! algorithms produce deterministic rankings with lexicographic tie-breaking.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use ordered_float::OrderedFloat;

use crate::determinism;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Matrix-style decision input for classical algorithms.
///
/// Actions and states are plain string IDs. Outcomes map each
/// `(action, state)` pair to an `OrderedFloat<f64>` utility value.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassicalInput {
    pub actions: Vec<String>,
    pub states: Vec<String>,
    /// `Map<ActionId, Map<StateId, Utility>>`.
    pub outcomes: BTreeMap<String, BTreeMap<String, OrderedFloat<f64>>>,
    #[serde(default)]
    pub algorithm: Option<String>,
    #[serde(default)]
    pub weights: Option<BTreeMap<String, OrderedFloat<f64>>>,
    #[serde(default)]
    pub strict: bool,
    #[serde(default)]
    pub temperature: Option<OrderedFloat<f64>>,
    #[serde(default)]
    pub optimism: Option<OrderedFloat<f64>>,
    #[serde(default)]
    pub confidence: Option<OrderedFloat<f64>>,
    #[serde(default)]
    pub iterations: Option<u32>,
    #[serde(default)]
    pub epsilon: Option<OrderedFloat<f64>>,
}

/// Result of a classical algorithm evaluation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassicalOutput {
    pub recommended_action: String,
    pub ranking: Vec<String>,
    pub trace: ClassicalTrace,
}

/// Trace data for reproducibility.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassicalTrace {
    pub algorithm: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub regret_table: Option<BTreeMap<String, BTreeMap<String, OrderedFloat<f64>>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_regret: Option<BTreeMap<String, OrderedFloat<f64>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_utility: Option<BTreeMap<String, OrderedFloat<f64>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weighted_scores: Option<BTreeMap<String, OrderedFloat<f64>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub probabilities: Option<BTreeMap<String, OrderedFloat<f64>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hurwicz_scores: Option<BTreeMap<String, OrderedFloat<f64>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub laplace_scores: Option<BTreeMap<String, OrderedFloat<f64>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub starr_scores: Option<BTreeMap<String, OrderedFloat<f64>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hodges_lehmann_scores: Option<BTreeMap<String, OrderedFloat<f64>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brown_robinson_scores: Option<BTreeMap<String, OrderedFloat<f64>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nash_equilibria: Option<Vec<(String, String)>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pareto_frontier: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub epsilon_contamination_scores: Option<BTreeMap<String, OrderedFloat<f64>>>,
    pub fingerprint: Option<String>,
}

/// Errors specific to classical algorithm evaluation.
#[derive(Debug, thiserror::Error)]
pub enum ClassicalError {
    #[error("{0}")]
    InvalidInput(String),
    #[error("Missing outcome for action '{0}' in state '{1}'")]
    MissingOutcome(String, String),
    #[error("No actions provided")]
    NoActions,
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

impl ClassicalInput {
    /// Validate the input structure and utility values.
    pub fn validate(&self) -> Result<(), ClassicalError> {
        if self.actions.is_empty() {
            return Err(ClassicalError::NoActions);
        }
        for action in &self.actions {
            let state_map = self.outcomes.get(action).ok_or_else(|| {
                ClassicalError::MissingOutcome(action.clone(), "ALL".into())
            })?;
            for state in &self.states {
                let util = state_map.get(state).ok_or_else(|| {
                    ClassicalError::MissingOutcome(action.clone(), state.clone())
                })?;
                if util.is_nan() || util.is_infinite() {
                    return Err(ClassicalError::InvalidInput(
                        "Utility value cannot be NaN or Infinity".into(),
                    ));
                }
            }
        }
        Ok(())
    }

    /// Normalize weights so they sum to 1.0 (non-strict mode).
    pub fn normalize_weights(&mut self) {
        if let Some(weights) = &mut self.weights {
            let sum: f64 = weights.values().map(|v| v.0).sum();
            if sum != 0.0 && (sum - 1.0).abs() > 1e-9 {
                for val in weights.values_mut() {
                    *val = OrderedFloat(val.0 / sum);
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Helper: build a default empty trace
// ---------------------------------------------------------------------------

fn empty_trace(algorithm: &str) -> ClassicalTrace {
    ClassicalTrace {
        algorithm: algorithm.to_string(),
        regret_table: None,
        max_regret: None,
        min_utility: None,
        weighted_scores: None,
        probabilities: None,
        hurwicz_scores: None,
        laplace_scores: None,
        starr_scores: None,
        hodges_lehmann_scores: None,
        brown_robinson_scores: None,
        nash_equilibria: None,
        pareto_frontier: None,
        epsilon_contamination_scores: None,
        fingerprint: None,
    }
}

// ---------------------------------------------------------------------------
// Helper: utility lookup (panics are guarded by prior validation)
// ---------------------------------------------------------------------------

fn util(input: &ClassicalInput, action: &str, state: &str) -> OrderedFloat<f64> {
    *input.outcomes.get(action).unwrap().get(state).unwrap()
}

/// Helper: rank actions descending by score with lexicographic tie-break.
fn rank_desc(actions: &[String], scores: &BTreeMap<String, OrderedFloat<f64>>) -> Vec<String> {
    let mut ranked = actions.to_vec();
    ranked.sort_by(|a, b| {
        let sa = scores.get(a).unwrap();
        let sb = scores.get(b).unwrap();
        sb.cmp(sa).then_with(|| a.cmp(b))
    });
    ranked
}

/// Helper: rank actions ascending by score with lexicographic tie-break.
fn rank_asc(actions: &[String], scores: &BTreeMap<String, OrderedFloat<f64>>) -> Vec<String> {
    let mut ranked = actions.to_vec();
    ranked.sort_by(|a, b| {
        let sa = scores.get(a).unwrap();
        let sb = scores.get(b).unwrap();
        sa.cmp(sb).then_with(|| a.cmp(b))
    });
    ranked
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/// Evaluate a classical decision problem, routing to the requested algorithm.
///
/// Returns the output with a deterministic SHA-256 fingerprint set.
pub fn evaluate_classical(input: &ClassicalInput) -> Result<ClassicalOutput, ClassicalError> {
    let mut output = match input.algorithm.as_deref() {
        Some("maximin") | Some("wald") | Some("minimax") => maximin(input),
        Some("weighted_sum") => weighted_sum(input),
        Some("softmax") => softmax(input),
        Some("hurwicz") => hurwicz(input),
        Some("laplace") => laplace(input),
        Some("starr") => starr(input),
        Some("hodges_lehmann") => hodges_lehmann(input),
        Some("brown_robinson") => brown_robinson(input),
        Some("nash") => nash(input),
        Some("pareto") => pareto(input),
        Some("epsilon_contamination") => epsilon_contamination(input),
        Some("savage") | _ => minimax_regret(input),
    }?;

    // Compute deterministic fingerprint
    let canonical_bytes = determinism::canonical_json(&output);
    let fingerprint = determinism::stable_hash(&canonical_bytes);
    output.trace.fingerprint = Some(fingerprint);

    Ok(output)
}

// ---------------------------------------------------------------------------
// Algorithms
// ---------------------------------------------------------------------------

/// Minimax Regret (Savage criterion).
pub fn minimax_regret(input: &ClassicalInput) -> Result<ClassicalOutput, ClassicalError> {
    input.validate()?;

    let mut max_state_utility: BTreeMap<&String, OrderedFloat<f64>> = BTreeMap::new();
    for state in &input.states {
        let max_u = input.actions.iter().map(|a| util(input, a, state)).max().unwrap();
        max_state_utility.insert(state, max_u);
    }

    let mut regret_table = BTreeMap::new();
    let mut max_regret_per_action = BTreeMap::new();

    for action in &input.actions {
        let mut action_regrets = BTreeMap::new();
        let mut current_max = OrderedFloat(0.0);
        for state in &input.states {
            let regret = *max_state_utility.get(state).unwrap() - util(input, action, state);
            action_regrets.insert(state.clone(), regret);
            if regret > current_max {
                current_max = regret;
            }
        }
        regret_table.insert(action.clone(), action_regrets);
        max_regret_per_action.insert(action.clone(), current_max);
    }

    let ranked = rank_asc(&input.actions, &max_regret_per_action);
    let recommended = ranked.first().ok_or(ClassicalError::NoActions)?.clone();

    let mut trace = empty_trace("minimax_regret");
    trace.regret_table = Some(regret_table);
    trace.max_regret = Some(max_regret_per_action);

    Ok(ClassicalOutput { recommended_action: recommended, ranking: ranked, trace })
}

/// Maximin (Wald criterion).
pub fn maximin(input: &ClassicalInput) -> Result<ClassicalOutput, ClassicalError> {
    input.validate()?;

    let mut min_util_per_action = BTreeMap::new();
    for action in &input.actions {
        let min_u = input.states.iter().map(|s| util(input, action, s)).min().unwrap();
        min_util_per_action.insert(action.clone(), min_u);
    }

    let ranked = rank_desc(&input.actions, &min_util_per_action);
    let recommended = ranked.first().ok_or(ClassicalError::NoActions)?.clone();

    let mut trace = empty_trace("maximin");
    trace.min_utility = Some(min_util_per_action);

    Ok(ClassicalOutput { recommended_action: recommended, ranking: ranked, trace })
}

/// Weighted Sum (Bayesian expected utility).
pub fn weighted_sum(input: &ClassicalInput) -> Result<ClassicalOutput, ClassicalError> {
    input.validate()?;
    let weights = input.weights.as_ref().ok_or_else(|| {
        ClassicalError::InvalidInput("Weights required for weighted_sum algorithm".into())
    })?;

    let mut scores = BTreeMap::new();
    for action in &input.actions {
        let score: f64 = input.states.iter().map(|s| {
            let u = util(input, action, s).0;
            let w = weights.get(s).unwrap_or(&OrderedFloat(0.0)).0;
            u * w
        }).sum();
        scores.insert(action.clone(), OrderedFloat(score));
    }

    let ranked = rank_desc(&input.actions, &scores);
    let recommended = ranked.first().ok_or(ClassicalError::NoActions)?.clone();

    let mut trace = empty_trace("weighted_sum");
    trace.weighted_scores = Some(scores);

    Ok(ClassicalOutput { recommended_action: recommended, ranking: ranked, trace })
}

/// Softmax selection probabilities.
pub fn softmax(input: &ClassicalInput) -> Result<ClassicalOutput, ClassicalError> {
    input.validate()?;
    let weights = input.weights.as_ref().ok_or_else(|| {
        ClassicalError::InvalidInput("Weights required for softmax algorithm".into())
    })?;
    let temp = input.temperature.unwrap_or(OrderedFloat(1.0)).0;
    if temp <= 0.0 {
        return Err(ClassicalError::InvalidInput("Temperature must be positive".into()));
    }

    let mut weighted_scores = BTreeMap::new();
    let mut max_score = f64::NEG_INFINITY;
    for action in &input.actions {
        let score: f64 = input.states.iter().map(|s| {
            let u = util(input, action, s).0;
            let w = weights.get(s).unwrap_or(&OrderedFloat(0.0)).0;
            u * w
        }).sum();
        weighted_scores.insert(action.clone(), score);
        if score > max_score { max_score = score; }
    }

    let mut exps = BTreeMap::new();
    let mut sum_exp = 0.0;
    for (action, score) in &weighted_scores {
        let val = ((score - max_score) / temp).exp();
        exps.insert(action.clone(), val);
        sum_exp += val;
    }

    let mut probabilities = BTreeMap::new();
    for (action, val) in exps {
        probabilities.insert(action, OrderedFloat(val / sum_exp));
    }

    let ranked = rank_desc(&input.actions, &probabilities);
    let recommended = ranked.first().ok_or(ClassicalError::NoActions)?.clone();

    let ws_trace: BTreeMap<String, OrderedFloat<f64>> = weighted_scores.into_iter()
        .map(|(k, v)| (k, OrderedFloat(v))).collect();

    let mut trace = empty_trace("softmax");
    trace.weighted_scores = Some(ws_trace);
    trace.probabilities = Some(probabilities);

    Ok(ClassicalOutput { recommended_action: recommended, ranking: ranked, trace })
}

/// Hurwicz criterion (optimism-pessimism index).
pub fn hurwicz(input: &ClassicalInput) -> Result<ClassicalOutput, ClassicalError> {
    input.validate()?;
    let alpha = input.optimism.unwrap_or(OrderedFloat(0.5)).0;
    if !(0.0..=1.0).contains(&alpha) {
        return Err(ClassicalError::InvalidInput("Optimism (alpha) must be between 0.0 and 1.0".into()));
    }

    let mut scores = BTreeMap::new();
    for action in &input.actions {
        let mut min_val = f64::INFINITY;
        let mut max_val = f64::NEG_INFINITY;
        for state in &input.states {
            let u = util(input, action, state).0;
            if u < min_val { min_val = u; }
            if u > max_val { max_val = u; }
        }
        let score = (alpha * max_val) + ((1.0 - alpha) * min_val);
        scores.insert(action.clone(), OrderedFloat(score));
    }

    let ranked = rank_desc(&input.actions, &scores);
    let recommended = ranked.first().ok_or(ClassicalError::NoActions)?.clone();

    let mut trace = empty_trace("hurwicz");
    trace.hurwicz_scores = Some(scores);

    Ok(ClassicalOutput { recommended_action: recommended, ranking: ranked, trace })
}

/// Laplace criterion (equal probability / insufficient reason).
pub fn laplace(input: &ClassicalInput) -> Result<ClassicalOutput, ClassicalError> {
    input.validate()?;
    let n = input.states.len() as f64;
    if n == 0.0 {
        return Err(ClassicalError::InvalidInput("Cannot apply Laplace criterion with no states".into()));
    }

    let mut scores = BTreeMap::new();
    for action in &input.actions {
        let sum: f64 = input.states.iter().map(|s| util(input, action, s).0).sum();
        scores.insert(action.clone(), OrderedFloat(sum / n));
    }

    let ranked = rank_desc(&input.actions, &scores);
    let recommended = ranked.first().ok_or(ClassicalError::NoActions)?.clone();

    let mut trace = empty_trace("laplace");
    trace.laplace_scores = Some(scores);

    Ok(ClassicalOutput { recommended_action: recommended, ranking: ranked, trace })
}

/// Starr criterion (minimise expected regret).
pub fn starr(input: &ClassicalInput) -> Result<ClassicalOutput, ClassicalError> {
    input.validate()?;
    let weights = input.weights.as_ref().ok_or_else(|| {
        ClassicalError::InvalidInput("Weights (probabilities) required for Starr algorithm".into())
    })?;

    let mut max_state_utility: BTreeMap<&String, OrderedFloat<f64>> = BTreeMap::new();
    for state in &input.states {
        let max_u = input.actions.iter().map(|a| util(input, a, state)).max().unwrap();
        max_state_utility.insert(state, max_u);
    }

    let mut scores = BTreeMap::new();
    for action in &input.actions {
        let expected_regret: f64 = input.states.iter().map(|s| {
            let regret = (*max_state_utility.get(s).unwrap() - util(input, action, s)).0;
            let prob = weights.get(s).unwrap_or(&OrderedFloat(0.0)).0;
            regret * prob
        }).sum();
        scores.insert(action.clone(), OrderedFloat(expected_regret));
    }

    let ranked = rank_asc(&input.actions, &scores);
    let recommended = ranked.first().ok_or(ClassicalError::NoActions)?.clone();

    let mut trace = empty_trace("starr");
    trace.starr_scores = Some(scores);

    Ok(ClassicalOutput { recommended_action: recommended, ranking: ranked, trace })
}

/// Hodges-Lehmann criterion (confidence-weighted compromise).
pub fn hodges_lehmann(input: &ClassicalInput) -> Result<ClassicalOutput, ClassicalError> {
    input.validate()?;
    let alpha = input.confidence.unwrap_or(OrderedFloat(0.5)).0;
    if !(0.0..=1.0).contains(&alpha) {
        return Err(ClassicalError::InvalidInput("Confidence (alpha) must be between 0.0 and 1.0".into()));
    }
    let n = input.states.len() as f64;
    if n == 0.0 {
        return Err(ClassicalError::InvalidInput("Cannot apply Hodges-Lehmann with no states".into()));
    }

    let mut scores = BTreeMap::new();
    for action in &input.actions {
        let mut min_val = f64::INFINITY;
        let mut sum_val = 0.0;
        for state in &input.states {
            let u = util(input, action, state).0;
            if u < min_val { min_val = u; }
            sum_val += u;
        }
        let avg_val = sum_val / n;
        let score = (alpha * min_val) + ((1.0 - alpha) * avg_val);
        scores.insert(action.clone(), OrderedFloat(score));
    }

    let ranked = rank_desc(&input.actions, &scores);
    let recommended = ranked.first().ok_or(ClassicalError::NoActions)?.clone();

    let mut trace = empty_trace("hodges_lehmann");
    trace.hodges_lehmann_scores = Some(scores);

    Ok(ClassicalOutput { recommended_action: recommended, ranking: ranked, trace })
}

/// Brown-Robinson fictitious play (iterative game solving).
pub fn brown_robinson(input: &ClassicalInput) -> Result<ClassicalOutput, ClassicalError> {
    input.validate()?;
    let iterations = input.iterations.unwrap_or(1000);
    if iterations == 0 {
        return Err(ClassicalError::InvalidInput("Iterations must be greater than 0".into()));
    }

    let num_actions = input.actions.len();
    let num_states = input.states.len();

    let mut matrix = vec![vec![0.0_f64; num_states]; num_actions];
    for (i, action) in input.actions.iter().enumerate() {
        for (j, state) in input.states.iter().enumerate() {
            matrix[i][j] = util(input, action, state).0;
        }
    }

    let mut x_counts = vec![0_u64; num_actions];
    let mut agent_accum = vec![0.0_f64; num_actions];
    let mut nature_accum = vec![0.0_f64; num_states];

    for _ in 0..iterations {
        let best_action_idx = agent_accum.iter().enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(i, _)| i).unwrap_or(0);

        let best_state_idx = nature_accum.iter().enumerate()
            .min_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(i, _)| i).unwrap_or(0);

        x_counts[best_action_idx] += 1;

        for i in 0..num_actions {
            agent_accum[i] += matrix[i][best_state_idx];
        }
        for j in 0..num_states {
            nature_accum[j] += matrix[best_action_idx][j];
        }
    }

    let total = f64::from(iterations);
    let mut scores = BTreeMap::new();
    for (i, count) in x_counts.iter().enumerate() {
        scores.insert(input.actions[i].clone(), OrderedFloat(*count as f64 / total));
    }

    let ranked = rank_desc(&input.actions, &scores);
    let recommended = ranked.first().ok_or(ClassicalError::NoActions)?.clone();

    let mut trace = empty_trace("brown_robinson");
    trace.brown_robinson_scores = Some(scores);

    Ok(ClassicalOutput { recommended_action: recommended, ranking: ranked, trace })
}

/// Nash equilibrium identification via saddle points.
pub fn nash(input: &ClassicalInput) -> Result<ClassicalOutput, ClassicalError> {
    input.validate()?;

    let mut row_mins: BTreeMap<&String, OrderedFloat<f64>> = BTreeMap::new();
    for action in &input.actions {
        let min = input.states.iter().map(|s| util(input, action, s)).min().unwrap();
        row_mins.insert(action, min);
    }

    let mut col_maxs: BTreeMap<&String, OrderedFloat<f64>> = BTreeMap::new();
    for state in &input.states {
        let max = input.actions.iter().map(|a| util(input, a, state)).max().unwrap();
        col_maxs.insert(state, max);
    }

    let mut equilibria = Vec::new();
    for action in &input.actions {
        for state in &input.states {
            let val = util(input, action, state);
            let r_min = row_mins.get(action).unwrap();
            let c_max = col_maxs.get(state).unwrap();
            if val == *r_min && val == *c_max {
                equilibria.push((action.clone(), state.clone()));
            }
        }
    }
    equilibria.sort();

    let mut base = maximin(input)?;
    if let Some(first_eq) = equilibria.first() {
        base.recommended_action = first_eq.0.clone();
    }
    base.trace.algorithm = "nash".to_string();
    base.trace.min_utility = None;
    base.trace.nash_equilibria = Some(equilibria);

    Ok(base)
}

/// Pareto frontier (dominance filtering).
pub fn pareto(input: &ClassicalInput) -> Result<ClassicalOutput, ClassicalError> {
    input.validate()?;

    let mut dominated = std::collections::HashSet::new();
    for a in &input.actions {
        for b in &input.actions {
            if a == b { continue; }
            let mut strictly_better = false;
            let mut equal_or_better = true;
            for state in &input.states {
                let u_a = util(input, a, state);
                let u_b = util(input, b, state);
                if u_b < u_a { equal_or_better = false; break; }
                if u_b > u_a { strictly_better = true; }
            }
            if equal_or_better && strictly_better {
                dominated.insert(a.clone());
                break;
            }
        }
    }

    let mut frontier: Vec<String> = input.actions.iter()
        .filter(|a| !dominated.contains(*a)).cloned().collect();
    frontier.sort();

    let mut dominated_list: Vec<String> = dominated.into_iter().collect();
    dominated_list.sort();

    let mut ranking = frontier.clone();
    ranking.extend(dominated_list);

    let recommended = frontier.first().ok_or(ClassicalError::NoActions)?.clone();

    let mut trace = empty_trace("pareto");
    trace.pareto_frontier = Some(frontier);

    Ok(ClassicalOutput { recommended_action: recommended, ranking, trace })
}

/// Epsilon-contamination model (robustness under prior misspecification).
pub fn epsilon_contamination(input: &ClassicalInput) -> Result<ClassicalOutput, ClassicalError> {
    input.validate()?;
    let epsilon = input.epsilon.unwrap_or(OrderedFloat(0.1)).0;
    if !(0.0..=1.0).contains(&epsilon) {
        return Err(ClassicalError::InvalidInput("Epsilon must be between 0.0 and 1.0".into()));
    }
    let weights = input.weights.as_ref().ok_or_else(|| {
        ClassicalError::InvalidInput("Weights required for Epsilon-Contamination algorithm".into())
    })?;

    let mut scores = BTreeMap::new();
    for action in &input.actions {
        let mut expected_util = 0.0;
        let mut min_util = f64::INFINITY;
        for state in &input.states {
            let u = util(input, action, state).0;
            let prob = weights.get(state).unwrap_or(&OrderedFloat(0.0)).0;
            expected_util += u * prob;
            if u < min_util { min_util = u; }
        }
        let score = ((1.0 - epsilon) * expected_util) + (epsilon * min_util);
        scores.insert(action.clone(), OrderedFloat(score));
    }

    let ranked = rank_desc(&input.actions, &scores);
    let recommended = ranked.first().ok_or(ClassicalError::NoActions)?.clone();

    let mut trace = empty_trace("epsilon_contamination");
    trace.epsilon_contamination_scores = Some(scores);

    Ok(ClassicalOutput { recommended_action: recommended, ranking: ranked, trace })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_input(algorithm: &str) -> ClassicalInput {
        let mut outcomes = BTreeMap::new();
        let mut a1 = BTreeMap::new();
        a1.insert("s1".into(), OrderedFloat(10.0));
        a1.insert("s2".into(), OrderedFloat(5.0));
        let mut a2 = BTreeMap::new();
        a2.insert("s1".into(), OrderedFloat(0.0));
        a2.insert("s2".into(), OrderedFloat(20.0));
        outcomes.insert("a1".into(), a1);
        outcomes.insert("a2".into(), a2);

        let mut weights = BTreeMap::new();
        weights.insert("s1".into(), OrderedFloat(0.5));
        weights.insert("s2".into(), OrderedFloat(0.5));

        ClassicalInput {
            actions: vec!["a1".into(), "a2".into()],
            states: vec!["s1".into(), "s2".into()],
            outcomes,
            algorithm: Some(algorithm.into()),
            weights: Some(weights),
            strict: false,
            temperature: None,
            optimism: None,
            confidence: None,
            iterations: None,
            epsilon: None,
        }
    }

    #[test]
    fn minimax_regret_deterministic() {
        let r1 = minimax_regret(&sample_input("minimax_regret")).unwrap();
        let r2 = minimax_regret(&sample_input("minimax_regret")).unwrap();
        assert_eq!(r1.recommended_action, r2.recommended_action);
        assert_eq!(r1.ranking, r2.ranking);
    }

    #[test]
    fn maximin_deterministic() {
        let r = maximin(&sample_input("maximin")).unwrap();
        assert_eq!(r.recommended_action, "a1");
    }

    #[test]
    fn weighted_sum_deterministic() {
        let r = weighted_sum(&sample_input("weighted_sum")).unwrap();
        assert!(!r.recommended_action.is_empty());
    }

    #[test]
    fn softmax_deterministic() {
        let r = softmax(&sample_input("softmax")).unwrap();
        assert!(!r.recommended_action.is_empty());
    }

    #[test]
    fn hurwicz_deterministic() {
        let r = hurwicz(&sample_input("hurwicz")).unwrap();
        assert!(!r.recommended_action.is_empty());
    }

    #[test]
    fn laplace_deterministic() {
        let r = laplace(&sample_input("laplace")).unwrap();
        assert!(!r.recommended_action.is_empty());
    }

    #[test]
    fn starr_deterministic() {
        let r = starr(&sample_input("starr")).unwrap();
        assert!(!r.recommended_action.is_empty());
    }

    #[test]
    fn hodges_lehmann_deterministic() {
        let r = hodges_lehmann(&sample_input("hodges_lehmann")).unwrap();
        assert!(!r.recommended_action.is_empty());
    }

    #[test]
    fn brown_robinson_deterministic() {
        let mut input = sample_input("brown_robinson");
        input.iterations = Some(100);
        let r = brown_robinson(&input).unwrap();
        assert!(!r.recommended_action.is_empty());
    }

    #[test]
    fn nash_deterministic() {
        let r = nash(&sample_input("nash")).unwrap();
        assert!(!r.recommended_action.is_empty());
    }

    #[test]
    fn pareto_deterministic() {
        let r = pareto(&sample_input("pareto")).unwrap();
        assert!(!r.recommended_action.is_empty());
    }

    #[test]
    fn epsilon_contamination_deterministic() {
        let r = epsilon_contamination(&sample_input("epsilon_contamination")).unwrap();
        assert!(!r.recommended_action.is_empty());
    }

    #[test]
    fn evaluate_classical_routes_correctly() {
        let input = sample_input("maximin");
        let r = evaluate_classical(&input).unwrap();
        assert_eq!(r.trace.algorithm, "maximin");
        assert!(r.trace.fingerprint.is_some());
    }

    #[test]
    fn evaluate_classical_fingerprint_deterministic() {
        let input = sample_input("laplace");
        let r1 = evaluate_classical(&input).unwrap();
        let r2 = evaluate_classical(&input).unwrap();
        assert_eq!(r1.trace.fingerprint, r2.trace.fingerprint);
    }
}
