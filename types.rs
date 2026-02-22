use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use ordered_float::OrderedFloat;
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionInput {
    pub actions: Vec<String>,
    pub states: Vec<String>,
    // Map<ActionId, Map<StateId, Utility>>
    pub outcomes: BTreeMap<String, BTreeMap<String, OrderedFloat<f64>>>,
    #[serde(default)]
    pub algorithm: Option<String>,
    #[serde(default)]
    pub weights: Option<BTreeMap<String, OrderedFloat<f64>>>,
    #[serde(default)]
    pub strict: bool,
    #[serde(default)]
    pub temperature: Option<OrderedFloat<f64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionOutput {
    pub recommended_action: String,
    pub ranking: Vec<String>,
    pub trace: DecisionTrace,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionTrace {
    pub algorithm: String,
    // Map<ActionId, Map<StateId, RegretValue>>
    #[serde(skip_serializing_if = "Option::is_none")]
    pub regret_table: Option<BTreeMap<String, BTreeMap<String, OrderedFloat<f64>>>>,
    // Map<ActionId, MaxRegret>
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_regret: Option<BTreeMap<String, OrderedFloat<f64>>>,
    // Map<ActionId, MinUtility>
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_utility: Option<BTreeMap<String, OrderedFloat<f64>>>,
    // Map<ActionId, WeightedScore>
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weighted_scores: Option<BTreeMap<String, OrderedFloat<f64>>>,
    // Map<ActionId, Probability>
    #[serde(skip_serializing_if = "Option::is_none")]
    pub probabilities: Option<BTreeMap<String, OrderedFloat<f64>>>,
    
    pub fingerprint: Option<String>,
}

#[derive(Error, Debug)]
pub enum ValidationError {
    #[error("Duplicate action IDs detected")]
    DuplicateActions,
    #[error("Duplicate state IDs detected")]
    DuplicateStates,
    #[error("Missing outcome for action '{0}' in state '{1}'")]
    MissingOutcome(String, String),
    #[error("Utility value cannot be NaN or Infinity")]
    InvalidUtility,
    #[error("Weights must sum to 1.0 (got {0})")]
    InvalidWeightSum(f64),
}

impl DecisionInput {
    pub fn validate(&self) -> Result<(), ValidationError> {
        // Check duplicates
        let action_set: HashSet<_> = self.actions.iter().collect();
        if action_set.len() != self.actions.len() {
            return Err(ValidationError::DuplicateActions);
        }

        let state_set: HashSet<_> = self.states.iter().collect();
        if state_set.len() != self.states.len() {
            return Err(ValidationError::DuplicateStates);
        }

        // Check completeness and validity
        self.validate_outcomes()?;

        if self.strict {
            self.validate_weights()?;
        }

        Ok(())
    }

    pub fn validate_outcomes(&self) -> Result<(), ValidationError> {
        for action in &self.actions {
            let state_map = self.outcomes.get(action)
                .ok_or_else(|| ValidationError::MissingOutcome(action.clone(), "ALL".to_string()))?;
            
            for state in &self.states {
                let util = state_map.get(state)
                    .ok_or_else(|| ValidationError::MissingOutcome(action.clone(), state.clone()))?;
                
                if util.is_nan() || util.is_infinite() {
                    return Err(ValidationError::InvalidUtility);
                }
            }
        }
        Ok(())
    }

    pub fn validate_structure(&self) -> Result<(), ValidationError> {
        for action in &self.actions {
            let state_map = self.outcomes.get(action)
                .ok_or_else(|| ValidationError::MissingOutcome(action.clone(), "ALL".to_string()))?;
            
            for state in &self.states {
                if !state_map.contains_key(state) {
                    return Err(ValidationError::MissingOutcome(action.clone(), state.clone()));
                }
            }
        }
        Ok(())
    }

    pub fn validate_weights(&self) -> Result<(), ValidationError> {
        if let Some(weights) = &self.weights {
            let sum: f64 = weights.values().map(|v| v.0).sum();
            if (sum - 1.0).abs() > 1e-9 {
                return Err(ValidationError::InvalidWeightSum(sum));
            }
        }
        Ok(())
    }

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