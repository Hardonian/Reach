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
}