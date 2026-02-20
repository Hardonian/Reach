use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "capability", content = "value", rename_all = "snake_case")]
pub enum Capability {
    ToolUse { name: String },
    EmitArtifact,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PolicyRule {
    pub capability: Capability,
    pub allow: bool,
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct Policy {
    #[serde(default)]
    pub rules: Vec<PolicyRule>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Decision {
    Allow,
    Deny(String),
}

impl Policy {
    #[must_use]
    pub fn evaluate(&self, requested: &Capability) -> Decision {
        self.rules
            .iter()
            .find(|rule| rule.capability == *requested)
            .map_or(Decision::Allow, |rule| {
                if rule.allow {
                    Decision::Allow
                } else {
                    Decision::Deny(rule.reason.clone().unwrap_or_else(|| {
                        // Include the capability in the default message so
                        // operators can identify which rule lacks a reason.
                        format!("capability denied by policy: {requested:?}")
                    }))
                }
            })
    }
}

/// Execution-level policy constraints for the state machine.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecutionPolicy {
    /// Maximum number of state transitions before the run is rejected.
    pub max_transitions: usize,
    /// Whether decision nodes are allowed in the workflow.
    pub allow_decisions: bool,
}

impl Default for ExecutionPolicy {
    fn default() -> Self {
        Self {
            max_transitions: usize::MAX,
            allow_decisions: true,
        }
    }
}

/// Errors arising from execution policy enforcement.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PolicyError {
    /// The run exceeded the maximum number of allowed state transitions.
    TransitionLimitReached,
    /// A decision node was encountered but decisions are disallowed by policy.
    DecisionNodeDisallowed,
}

impl ExecutionPolicy {
    /// Check whether a transition is permitted given the current count.
    pub fn evaluate_transition(&self, transitions: usize) -> Result<(), PolicyError> {
        if transitions >= self.max_transitions {
            return Err(PolicyError::TransitionLimitReached);
        }
        Ok(())
    }

    /// Check whether decision nodes are allowed.
    pub fn evaluate_decision(&self) -> Result<(), PolicyError> {
        if !self.allow_decisions {
            return Err(PolicyError::DecisionNodeDisallowed);
        }
        Ok(())
    }
}
