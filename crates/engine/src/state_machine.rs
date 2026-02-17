use crate::events::{EngineEvent, EventKind};
use crate::ir::{NodeKind, Workflow};
use crate::policy::{ExecutionPolicy, PolicyError};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MachineState {
    Idle,
    Running { current: String, transitions: usize },
    Completed,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MachineError {
    InvalidWorkflow(String),
    NodeMissing(String),
    PolicyViolation(PolicyError),
    NoSuccessor(String),
}

impl From<PolicyError> for MachineError {
    fn from(value: PolicyError) -> Self {
        Self::PolicyViolation(value)
    }
}

#[derive(Clone, Debug)]
pub struct WorkflowMachine {
    workflow: Workflow,
    policy: ExecutionPolicy,
    state: MachineState,
    sequence: u64,
}

impl WorkflowMachine {
    pub fn new(workflow: Workflow, policy: ExecutionPolicy) -> Result<Self, MachineError> {
        workflow.validate().map_err(MachineError::InvalidWorkflow)?;

        Ok(Self {
            workflow,
            policy,
            state: MachineState::Idle,
            sequence: 0,
        })
    }

    #[must_use]
    pub fn state(&self) -> &MachineState {
        &self.state
    }

    pub fn start(&mut self) -> Result<EngineEvent, MachineError> {
        self.state = MachineState::Running {
            current: self.workflow.start.clone(),
            transitions: 0,
        };
        self.next_event(EventKind::Entered)
    }

    pub fn step(&mut self) -> Result<EngineEvent, MachineError> {
        let (current, transitions) = match &self.state {
            MachineState::Running {
                current,
                transitions,
            } => (current.clone(), *transitions),
            MachineState::Idle => return self.start(),
            MachineState::Completed => return self.next_event(EventKind::Completed),
        };

        self.policy.evaluate_transition(transitions)?;

        let node = self
            .workflow
            .node(&current)
            .ok_or_else(|| MachineError::NodeMissing(current.clone()))?;

        match &node.kind {
            NodeKind::Decision { .. } => {
                self.policy.evaluate_decision()?;
            }
            NodeKind::Task { .. } | NodeKind::Terminal => {}
        }

        if matches!(node.kind, NodeKind::Terminal) {
            self.state = MachineState::Completed;
            return self.next_event(EventKind::Completed);
        }

        let next = node
            .next
            .first()
            .ok_or_else(|| MachineError::NoSuccessor(current.clone()))?
            .clone();

        self.state = MachineState::Running {
            current: next.clone(),
            transitions: transitions + 1,
        };

        self.next_event(EventKind::Entered)
    }

    fn next_event(&mut self, kind: EventKind) -> Result<EngineEvent, MachineError> {
        self.sequence += 1;
        let node_id = match &self.state {
            MachineState::Idle => self.workflow.start.clone(),
            MachineState::Running { current, .. } => current.clone(),
            MachineState::Completed => "completed".to_string(),
        };

        if node_id.is_empty() {
            return Err(MachineError::InvalidWorkflow(
                "event node id must not be empty".to_string(),
            ));
        }

        Ok(EngineEvent::new(self.sequence, node_id, kind))
    }
}

#[cfg(test)]
mod tests {
    use crate::ir::{NodeKind, Workflow, WorkflowNode};
    use crate::policy::{ExecutionPolicy, PolicyError};
    use crate::state_machine::{MachineError, MachineState, WorkflowMachine};
    use std::collections::BTreeMap;

    fn sample_workflow() -> Workflow {
        let nodes = BTreeMap::from([
            (
                "start".to_string(),
                WorkflowNode {
                    kind: NodeKind::Task {
                        name: "collect".to_string(),
                    },
                    next: vec!["decide".to_string()],
                },
            ),
            (
                "decide".to_string(),
                WorkflowNode {
                    kind: NodeKind::Decision {
                        expression: "allow".to_string(),
                    },
                    next: vec!["done".to_string()],
                },
            ),
            (
                "done".to_string(),
                WorkflowNode {
                    kind: NodeKind::Terminal,
                    next: vec![],
                },
            ),
        ]);

        Workflow {
            id: "wf".to_string(),
            start: "start".to_string(),
            nodes,
        }
    }

    #[test]
    fn machine_steps_in_order() {
        let mut machine = WorkflowMachine::new(sample_workflow(), ExecutionPolicy::default())
            .expect("machine must construct");

        let event_1 = machine.start().expect("start should emit event");
        assert_eq!(event_1.sequence, 1);
        assert_eq!(event_1.node_id, "start");

        let event_2 = machine.step().expect("first step should succeed");
        assert_eq!(event_2.sequence, 2);
        assert_eq!(event_2.node_id, "decide");

        let event_3 = machine.step().expect("second step should succeed");
        assert_eq!(event_3.sequence, 3);
        assert_eq!(event_3.node_id, "done");

        let event_4 = machine.step().expect("terminal step should complete");
        assert_eq!(event_4.sequence, 4);
        assert_eq!(event_4.node_id, "completed");
        assert!(matches!(machine.state(), MachineState::Completed));
    }

    #[test]
    fn machine_reports_policy_violation() {
        let policy = ExecutionPolicy {
            max_transitions: 1,
            allow_decisions: false,
        };
        let mut machine = WorkflowMachine::new(sample_workflow(), policy).expect("construct");

        let _ = machine.start().expect("start should work");
        let _ = machine.step().expect("first step should work");
        let result = machine.step();

        assert_eq!(
            result,
            Err(MachineError::PolicyViolation(
                PolicyError::TransitionLimitReached
            ))
        );
    }
}
