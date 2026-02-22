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
            regret_table,
            max_regret: max_regret_per_action,
            fingerprint: None, // Calculated by caller
        },
    })
}