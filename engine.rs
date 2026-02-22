use crate::types::{DecisionInput, DecisionOutput, DecisionTrace};
use std::collections::BTreeMap;
use ordered_float::OrderedFloat;
use anyhow::Result;

pub fn minimax_regret(input: &DecisionInput) -> Result<DecisionOutput> {
    // 1. Calculate Max Utility per State: M(s) = max_a U(a, s)
    let mut max_state_utility: BTreeMap<&String, OrderedFloat<f64>> = BTreeMap::new();

    for state in &input.states {
        let max_util = input.actions.iter()
            .map(|a| input.outcomes.get(a).unwrap().get(state).unwrap())
            .max()
            .unwrap(); // Safe due to validation
        max_state_utility.insert(state, *max_util);
    }

    // 2. Calculate Regret Table: R(a, s) = M(s) - U(a, s)
    let mut regret_table = BTreeMap::new();
    let mut max_regret_per_action = BTreeMap::new();

    for action in &input.actions {
        let mut action_regrets = BTreeMap::new();
        let mut current_max_regret = OrderedFloat(0.0);

        for state in &input.states {
            let util = input.outcomes.get(action).unwrap().get(state).unwrap();
            let max_util = max_state_utility.get(state).unwrap();
            let regret = *max_util - *util;
            
            action_regrets.insert(state.clone(), regret);
            if regret > current_max_regret {
                current_max_regret = regret;
            }
        }
        regret_table.insert(action.clone(), action_regrets);
        max_regret_per_action.insert(action.clone(), current_max_regret);
    }

    // 3. Find Minimax Regret (Minimize the Max Regret)
    // Sort by regret (asc), then by action ID (asc) for determinism
    let mut ranked_actions = input.actions.clone();
    ranked_actions.sort_by(|a, b| {
        let reg_a = max_regret_per_action.get(a).unwrap();
        let reg_b = max_regret_per_action.get(b).unwrap();
        match reg_a.cmp(reg_b) {
            std::cmp::Ordering::Equal => a.cmp(b), // Tie-break: Lexicographic
            other => other,
        }
    });

    let recommended = ranked_actions.first().unwrap().clone();

    Ok(DecisionOutput {
        recommended_action: recommended,
        ranking: ranked_actions,
        trace: DecisionTrace {
            algorithm: "minimax_regret".to_string(),
            regret_table: Some(regret_table),
            max_regret: Some(max_regret_per_action),
            min_utility: None,
            fingerprint: None, // Calculated by caller
        },
    })
}

pub fn maximin(input: &DecisionInput) -> Result<DecisionOutput> {
    // 1. Calculate Min Utility per Action
    let mut min_utility_per_action = BTreeMap::new();

    for action in &input.actions {
        let mut current_min = OrderedFloat(f64::INFINITY);

        for state in &input.states {
            // Safe due to validation
            let util = input.outcomes.get(action).unwrap().get(state).unwrap();
            if *util < current_min {
                current_min = *util;
            }
        }
        min_utility_per_action.insert(action.clone(), current_min);
    }

    // 2. Rank Actions (Maximize the Minimum Utility)
    let mut ranked_actions = input.actions.clone();
    ranked_actions.sort_by(|a, b| {
        let min_a = min_utility_per_action.get(a).unwrap();
        let min_b = min_utility_per_action.get(b).unwrap();
        // Descending order for utility (higher is better)
        match min_b.cmp(min_a) {
            std::cmp::Ordering::Equal => a.cmp(b), // Tie-break: Lexicographic (asc)
            other => other,
        }
    });

    let recommended = ranked_actions.first().ok_or_else(|| anyhow::anyhow!("No actions provided"))?.clone();

    Ok(DecisionOutput {
        recommended_action: recommended,
        ranking: ranked_actions,
        trace: DecisionTrace {
            algorithm: "maximin".to_string(),
            regret_table: None,
            max_regret: None,
            min_utility: Some(min_utility_per_action),
            fingerprint: None,
        },
    })
}

pub fn weighted_sum(input: &DecisionInput) -> Result<DecisionOutput> {
    // 1. Validate Weights
    let weights = input.weights.as_ref()
        .ok_or_else(|| anyhow::anyhow!("Weights required for weighted_sum algorithm"))?;

    // 2. Calculate Weighted Scores: S(a) = Sum(U(a, s) * W(s))
    let mut weighted_scores = BTreeMap::new();

    for action in &input.actions {
        let mut score = 0.0;
        for state in &input.states {
            // Safe due to validation
            let util = input.outcomes.get(action).unwrap().get(state).unwrap();
            // Default to 0.0 weight if state missing from weights map (or error? treating as 0 for robustness)
            let weight = weights.get(state).unwrap_or(&OrderedFloat(0.0));
            score += util.0 * weight.0;
        }
        weighted_scores.insert(action.clone(), OrderedFloat(score));
    }

    // 3. Rank Actions (Maximize Score)
    let mut ranked_actions = input.actions.clone();
    ranked_actions.sort_by(|a, b| {
        let score_a = weighted_scores.get(a).unwrap();
        let score_b = weighted_scores.get(b).unwrap();
        // Descending order
        match score_b.cmp(score_a) {
            std::cmp::Ordering::Equal => a.cmp(b), // Tie-break: Lexicographic
            other => other,
        }
    });

    let recommended = ranked_actions.first().ok_or_else(|| anyhow::anyhow!("No actions provided"))?.clone();

    Ok(DecisionOutput {
        recommended_action: recommended,
        ranking: ranked_actions,
        trace: DecisionTrace {
            algorithm: "weighted_sum".to_string(),
            regret_table: None,
            max_regret: None,
            min_utility: None,
            weighted_scores: Some(weighted_scores),
            fingerprint: None,
        },
    })
}

pub fn softmax(input: &DecisionInput) -> Result<DecisionOutput> {
    // 1. Validate Inputs
    let weights = input.weights.as_ref()
        .ok_or_else(|| anyhow::anyhow!("Weights required for softmax algorithm"))?;
    
    let temp = input.temperature.unwrap_or(OrderedFloat(1.0)).0;
    if temp <= 0.0 {
        return Err(anyhow::anyhow!("Temperature must be positive"));
    }

    // 2. Calculate Weighted Scores (Expected Utility)
    let mut weighted_scores = BTreeMap::new();
    let mut max_score = f64::NEG_INFINITY;

    for action in &input.actions {
        let mut score = 0.0;
        for state in &input.states {
            let util = input.outcomes.get(action).unwrap().get(state).unwrap();
            let weight = weights.get(state).unwrap_or(&OrderedFloat(0.0));
            score += util.0 * weight.0;
        }
        weighted_scores.insert(action.clone(), score);
        if score > max_score {
            max_score = score;
        }
    }

    // 3. Calculate Probabilities: P(a) = exp((score - max) / temp) / sum
    let mut probabilities = BTreeMap::new();
    let mut sum_exp = 0.0;
    let mut exps = BTreeMap::new();

    for (action, score) in &weighted_scores {
        let val = ((score - max_score) / temp).exp();
        exps.insert(action.clone(), val);
        sum_exp += val;
    }

    for (action, val) in exps {
        probabilities.insert(action, OrderedFloat(val / sum_exp));
    }

    // 4. Rank Actions (by Probability, descending)
    let mut ranked_actions = input.actions.clone();
    ranked_actions.sort_by(|a, b| {
        let prob_a = probabilities.get(a).unwrap();
        let prob_b = probabilities.get(b).unwrap();
        match prob_b.cmp(prob_a) {
            std::cmp::Ordering::Equal => a.cmp(b),
            other => other,
        }
    });

    let recommended = ranked_actions.first().ok_or_else(|| anyhow::anyhow!("No actions provided"))?.clone();

    // Convert scores to OrderedFloat for trace
    let weighted_scores_trace: BTreeMap<String, OrderedFloat<f64>> = weighted_scores.into_iter()
        .map(|(k, v)| (k, OrderedFloat(v)))
        .collect();

    Ok(DecisionOutput {
        recommended_action: recommended,
        ranking: ranked_actions,
        trace: DecisionTrace {
            algorithm: "softmax".to_string(),
            regret_table: None,
            max_regret: None,
            min_utility: None,
            weighted_scores: Some(weighted_scores_trace),
            probabilities: Some(probabilities),
            fingerprint: None,
        },
    })
}

pub fn hurwicz(input: &DecisionInput) -> Result<DecisionOutput> {
    let alpha = input.optimism.unwrap_or(OrderedFloat(0.5)).0;
    if alpha < 0.0 || alpha > 1.0 {
        return Err(anyhow::anyhow!("Optimism (alpha) must be between 0.0 and 1.0"));
    }

    let mut hurwicz_scores = BTreeMap::new();

    for action in &input.actions {
        let mut min_val = f64::INFINITY;
        let mut max_val = f64::NEG_INFINITY;

        for state in &input.states {
            // Safe due to validation
            let util = input.outcomes.get(action).unwrap().get(state).unwrap().0;
            if util < min_val { min_val = util; }
            if util > max_val { max_val = util; }
        }
        
        let score = (alpha * max_val) + ((1.0 - alpha) * min_val);
        hurwicz_scores.insert(action.clone(), OrderedFloat(score));
    }

    // Rank Actions (Maximize Score)
    let mut ranked_actions = input.actions.clone();
    ranked_actions.sort_by(|a, b| {
        let score_a = hurwicz_scores.get(a).unwrap();
        let score_b = hurwicz_scores.get(b).unwrap();
        match score_b.cmp(score_a) {
            std::cmp::Ordering::Equal => a.cmp(b),
            other => other,
        }
    });

    let recommended = ranked_actions.first().ok_or_else(|| anyhow::anyhow!("No actions provided"))?.clone();

    Ok(DecisionOutput {
        recommended_action: recommended,
        ranking: ranked_actions,
        trace: DecisionTrace {
            algorithm: "hurwicz".to_string(),
            regret_table: None,
            max_regret: None,
            min_utility: None,
            weighted_scores: None,
            probabilities: None,
            hurwicz_scores: Some(hurwicz_scores),
            fingerprint: None,
        },
    })
}

pub fn laplace(input: &DecisionInput) -> Result<DecisionOutput> {
    let num_states = input.states.len() as f64;
    if num_states == 0.0 {
        return Err(anyhow::anyhow!("Cannot apply Laplace criterion with no states"));
    }

    let mut laplace_scores = BTreeMap::new();

    for action in &input.actions {
        let mut sum_util = 0.0;
        for state in &input.states {
            // Safe due to validation
            let util = input.outcomes.get(action).unwrap().get(state).unwrap().0;
            sum_util += util;
        }
        let score = sum_util / num_states;
        laplace_scores.insert(action.clone(), OrderedFloat(score));
    }

    // Rank Actions (Maximize Score)
    let mut ranked_actions = input.actions.clone();
    ranked_actions.sort_by(|a, b| {
        let score_a = laplace_scores.get(a).unwrap();
        let score_b = laplace_scores.get(b).unwrap();
        match score_b.cmp(score_a) {
            std::cmp::Ordering::Equal => a.cmp(b),
            other => other,
        }
    });

    let recommended = ranked_actions.first().ok_or_else(|| anyhow::anyhow!("No actions provided"))?.clone();

    Ok(DecisionOutput {
        recommended_action: recommended,
        ranking: ranked_actions,
        trace: DecisionTrace {
            algorithm: "laplace".to_string(),
            regret_table: None,
            max_regret: None,
            min_utility: None,
            weighted_scores: None,
            probabilities: None,
            hurwicz_scores: None,
            laplace_scores: Some(laplace_scores),
            fingerprint: None,
        },
    })
}

pub fn starr(input: &DecisionInput) -> Result<DecisionOutput> {
    // 1. Validate Weights
    let weights = input.weights.as_ref()
        .ok_or_else(|| anyhow::anyhow!("Weights (probabilities) required for Starr algorithm"))?;

    // 2. Calculate Max Utility per State
    let mut max_state_utility: BTreeMap<&String, OrderedFloat<f64>> = BTreeMap::new();
    for state in &input.states {
        let max_util = input.actions.iter()
            .map(|a| input.outcomes.get(a).unwrap().get(state).unwrap())
            .max()
            .unwrap();
        max_state_utility.insert(state, *max_util);
    }

    // 3. Calculate Expected Regret per Action
    let mut starr_scores = BTreeMap::new();

    for action in &input.actions {
        let mut expected_regret = 0.0;
        for state in &input.states {
            let util = input.outcomes.get(action).unwrap().get(state).unwrap();
            let max_util = max_state_utility.get(state).unwrap();
            let regret = *max_util - *util;
            
            let prob = weights.get(state).unwrap_or(&OrderedFloat(0.0));
            expected_regret += regret.0 * prob.0;
        }
        starr_scores.insert(action.clone(), OrderedFloat(expected_regret));
    }

    // 4. Rank Actions (Minimize Expected Regret)
    let mut ranked_actions = input.actions.clone();
    ranked_actions.sort_by(|a, b| {
        let score_a = starr_scores.get(a).unwrap();
        let score_b = starr_scores.get(b).unwrap();
        // Ascending order (lower regret is better)
        match score_a.cmp(score_b) {
            std::cmp::Ordering::Equal => a.cmp(b),
            other => other,
        }
    });

    let recommended = ranked_actions.first().ok_or_else(|| anyhow::anyhow!("No actions provided"))?.clone();

    Ok(DecisionOutput {
        recommended_action: recommended,
        ranking: ranked_actions,
        trace: DecisionTrace {
            algorithm: "starr".to_string(),
            regret_table: None,
            max_regret: None,
            min_utility: None,
            weighted_scores: None,
            probabilities: None,
            hurwicz_scores: None,
            laplace_scores: None,
            starr_scores: Some(starr_scores),
            fingerprint: None,
        },
    })
}

pub fn hodges_lehmann(input: &DecisionInput) -> Result<DecisionOutput> {
    let alpha = input.confidence.unwrap_or(OrderedFloat(0.5)).0;
    if alpha < 0.0 || alpha > 1.0 {
        return Err(anyhow::anyhow!("Confidence (alpha) must be between 0.0 and 1.0"));
    }
    
    let num_states = input.states.len() as f64;
    if num_states == 0.0 {
        return Err(anyhow::anyhow!("Cannot apply Hodges-Lehmann criterion with no states"));
    }

    let mut hl_scores = BTreeMap::new();

    for action in &input.actions {
        let mut min_val = f64::INFINITY;
        let mut sum_val = 0.0;

        for state in &input.states {
            // Safe due to validation
            let util = input.outcomes.get(action).unwrap().get(state).unwrap().0;
            if util < min_val { min_val = util; }
            sum_val += util;
        }
        
        let avg_val = sum_val / num_states;
        let score = (alpha * min_val) + ((1.0 - alpha) * avg_val);
        hl_scores.insert(action.clone(), OrderedFloat(score));
    }

    // Rank Actions (Maximize Score)
    let mut ranked_actions = input.actions.clone();
    ranked_actions.sort_by(|a, b| {
        let score_a = hl_scores.get(a).unwrap();
        let score_b = hl_scores.get(b).unwrap();
        match score_b.cmp(score_a) {
            std::cmp::Ordering::Equal => a.cmp(b),
            other => other,
        }
    });

    let recommended = ranked_actions.first().ok_or_else(|| anyhow::anyhow!("No actions provided"))?.clone();

    Ok(DecisionOutput {
        recommended_action: recommended,
        ranking: ranked_actions,
        trace: DecisionTrace {
            algorithm: "hodges_lehmann".to_string(),
            regret_table: None,
            max_regret: None,
            min_utility: None,
            weighted_scores: None,
            probabilities: None,
            hurwicz_scores: None,
            laplace_scores: None,
            starr_scores: None,
            hodges_lehmann_scores: Some(hl_scores),
            fingerprint: None,
        },
    })
}