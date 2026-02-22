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

pub fn brown_robinson(input: &DecisionInput) -> Result<DecisionOutput> {
    let iterations = input.iterations.unwrap_or(1000);
    if iterations == 0 {
        return Err(anyhow::anyhow!("Iterations must be greater than 0"));
    }

    let num_actions = input.actions.len();
    let num_states = input.states.len();

    // Build payoff matrix based on input vector order
    let mut matrix = vec![vec![0.0; num_states]; num_actions];
    for (i, action) in input.actions.iter().enumerate() {
        let state_map = input.outcomes.get(action).unwrap();
        for (j, state) in input.states.iter().enumerate() {
            let util = state_map.get(state).unwrap();
            matrix[i][j] = util.0;
        }
    }

    let mut x_counts = vec![0; num_actions];
    // let mut y_counts = vec![0; num_states]; // Not strictly needed for result, but part of algo

    let mut agent_accum = vec![0.0; num_actions]; // Accumulated payoff for Agent if they played row i against Nature's history
    let mut nature_accum = vec![0.0; num_states]; // Accumulated payoff for Agent if Nature played col j against Agent's history

    for _ in 0..iterations {
        // 1. Agent chooses action i to maximize expected utility (agent_accum)
        let mut best_action_idx = 0;
        let mut max_val = f64::NEG_INFINITY;
        
        for i in 0..num_actions {
            let val = agent_accum[i];
            if val > max_val {
                max_val = val;
                best_action_idx = i;
            }
        }

        // 2. Nature chooses state j to minimize Agent's utility (nature_accum)
        let mut best_state_idx = 0;
        let mut min_val = f64::INFINITY;

        for j in 0..num_states {
            let val = nature_accum[j];
            if val < min_val {
                min_val = val;
                best_state_idx = j;
            }
        }

        // 3. Update counts
        x_counts[best_action_idx] += 1;
        // y_counts[best_state_idx] += 1;

        // 4. Update accumulators
        for i in 0..num_actions {
            agent_accum[i] += matrix[i][best_state_idx];
        }
        for j in 0..num_states {
            nature_accum[j] += matrix[best_action_idx][j];
        }
    }

    // Calculate probabilities (frequencies)
    let mut scores = BTreeMap::new();
    let total = iterations as f64;
    for (i, count) in x_counts.iter().enumerate() {
        scores.insert(input.actions[i].clone(), OrderedFloat(*count as f64 / total));
    }

    // Rank Actions (Maximize Probability/Frequency)
    let mut ranked_actions = input.actions.clone();
    ranked_actions.sort_by(|a, b| {
        let s_a = scores.get(a).unwrap();
        let s_b = scores.get(b).unwrap();
        match s_b.cmp(s_a) {
            std::cmp::Ordering::Equal => a.cmp(b),
            other => other,
        }
    });

    let recommended = ranked_actions.first().ok_or_else(|| anyhow::anyhow!("No actions provided"))?.clone();

    Ok(DecisionOutput {
        recommended_action: recommended,
        ranking: ranked_actions,
        trace: DecisionTrace {
            algorithm: "brown_robinson".to_string(),
            regret_table: None,
            max_regret: None,
            min_utility: None,
            weighted_scores: None,
            probabilities: None,
            hurwicz_scores: None,
            laplace_scores: None,
            starr_scores: None,
            hodges_lehmann_scores: None,
            brown_robinson_scores: Some(scores),
            fingerprint: None,
        },
    })
}

pub fn nash(input: &DecisionInput) -> Result<DecisionOutput> {
    // 1. Find Saddle Points
    // A cell (a, s) is a saddle point if it is the minimum in its row and maximum in its column.
    // Row Player (Agent) maximizes, Column Player (Nature) minimizes (Zero-Sum assumption).
    
    let mut row_mins = BTreeMap::new();
    for action in &input.actions {
        let mut min = OrderedFloat(f64::INFINITY);
        for state in &input.states {
             let val = input.outcomes.get(action).unwrap().get(state).unwrap();
             if *val < min { min = *val; }
        }
        row_mins.insert(action, min);
    }

    let mut col_maxs = BTreeMap::new();
    for state in &input.states {
        let mut max = OrderedFloat(f64::NEG_INFINITY);
        for action in &input.actions {
             let val = input.outcomes.get(action).unwrap().get(state).unwrap();
             if *val > max { max = *val; }
        }
        col_maxs.insert(state, max);
    }

    let mut equilibria = Vec::new();
    for action in &input.actions {
        for state in &input.states {
            let val = input.outcomes.get(action).unwrap().get(state).unwrap();
            let r_min = row_mins.get(action).unwrap();
            let c_max = col_maxs.get(state).unwrap();
            
            if val == r_min && val == c_max {
                equilibria.push((action.clone(), state.clone()));
            }
        }
    }
    
    // Sort for determinism
    equilibria.sort();

    // Use Maximin for base ranking and fallback recommendation
    let mut maximin_output = maximin(input)?;
    
    // If equilibria exist, recommend the action from the first one
    if let Some(first_eq) = equilibria.first() {
        maximin_output.recommended_action = first_eq.0.clone();
    }

    maximin_output.trace.algorithm = "nash".to_string();
    maximin_output.trace.min_utility = None; // Clear maximin specific trace if desired, or keep it. Let's clear to be clean.
    maximin_output.trace.nash_equilibria = Some(equilibria);

    Ok(maximin_output)
}

pub fn pareto(input: &DecisionInput) -> Result<DecisionOutput> {
    let mut dominated = std::collections::HashSet::new();
    
    for a in &input.actions {
        for b in &input.actions {
            if a == b { continue; }
            
            // Check if b dominates a
            // b dominates a if U(b, s) >= U(a, s) for all s, and > for at least one s.
            let mut strictly_better = false;
            let mut equal_or_better = true;
            
            for state in &input.states {
                let u_a = input.outcomes.get(a).unwrap().get(state).unwrap();
                let u_b = input.outcomes.get(b).unwrap().get(state).unwrap();
                
                if u_b < u_a {
                    equal_or_better = false;
                    break;
                }
                if u_b > u_a {
                    strictly_better = true;
                }
            }
            
            if equal_or_better && strictly_better {
                dominated.insert(a.clone());
                break; // a is dominated, no need to check against other actions
            }
        }
    }
    
    let mut frontier: Vec<String> = input.actions.iter()
        .filter(|a| !dominated.contains(*a))
        .cloned()
        .collect();
    frontier.sort(); // Deterministic order
    
    let mut dominated_list: Vec<String> = dominated.into_iter().collect();
    dominated_list.sort();
    
    let mut ranking = frontier.clone();
    ranking.extend(dominated_list);
    
    let recommended = frontier.first().ok_or_else(|| anyhow::anyhow!("No actions provided"))?.clone();
    
    Ok(DecisionOutput {
        recommended_action: recommended,
        ranking,
        trace: DecisionTrace {
            algorithm: "pareto".to_string(),
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
            pareto_frontier: Some(frontier),
            fingerprint: None,
        },
    })
}

pub fn epsilon_contamination(input: &DecisionInput) -> Result<DecisionOutput> {
    let epsilon = input.epsilon.unwrap_or(OrderedFloat(0.1)).0;
    if epsilon < 0.0 || epsilon > 1.0 {
        return Err(anyhow::anyhow!("Epsilon must be between 0.0 and 1.0"));
    }

    let weights = input.weights.as_ref()
        .ok_or_else(|| anyhow::anyhow!("Weights required for Epsilon-Contamination algorithm"))?;

    let mut scores = BTreeMap::new();

    for action in &input.actions {
        let mut expected_util = 0.0;
        let mut min_util = f64::INFINITY;

        for state in &input.states {
            // Safe due to validation
            let util = input.outcomes.get(action).unwrap().get(state).unwrap().0;
            let prob = weights.get(state).unwrap_or(&OrderedFloat(0.0)).0;
            
            expected_util += util * prob;
            if util < min_util {
                min_util = util;
            }
        }
        
        // Score = (1 - epsilon) * E[U] + epsilon * min(U)
        let score = ((1.0 - epsilon) * expected_util) + (epsilon * min_util);
        scores.insert(action.clone(), OrderedFloat(score));
    }

    // Rank Actions (Maximize Score)
    let mut ranked_actions = input.actions.clone();
    ranked_actions.sort_by(|a, b| {
        let score_a = scores.get(a).unwrap();
        let score_b = scores.get(b).unwrap();
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
            algorithm: "epsilon_contamination".to_string(),
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
            epsilon_contamination_scores: Some(scores),
            fingerprint: None,
        },
    })
}