#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ExecutionPolicy {
    pub max_transitions: usize,
    pub allow_decisions: bool,
}

impl Default for ExecutionPolicy {
    fn default() -> Self {
        Self {
            max_transitions: 128,
            allow_decisions: true,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Decision {
    Allow,
    Deny,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PolicyError {
    TransitionLimitReached,
    DecisionsDisabled,
}

impl ExecutionPolicy {
    pub fn evaluate_transition(&self, transitions: usize) -> Result<Decision, PolicyError> {
        if transitions >= self.max_transitions {
            return Err(PolicyError::TransitionLimitReached);
        }
        Ok(Decision::Allow)
    }

    pub fn evaluate_decision(&self) -> Result<Decision, PolicyError> {
        if self.allow_decisions {
            Ok(Decision::Allow)
        } else {
            Err(PolicyError::DecisionsDisabled)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{ExecutionPolicy, PolicyError};

    #[test]
    fn transition_limit_is_enforced() {
        let policy = ExecutionPolicy {
            max_transitions: 1,
            allow_decisions: true,
        };

        assert_eq!(
            policy.evaluate_transition(1),
            Err(PolicyError::TransitionLimitReached)
        );
    }

    #[test]
    fn decision_gate_is_enforced() {
        let policy = ExecutionPolicy {
            max_transitions: 10,
            allow_decisions: false,
        };

        assert_eq!(
            policy.evaluate_decision(),
            Err(PolicyError::DecisionsDisabled)
        );
    }
}
