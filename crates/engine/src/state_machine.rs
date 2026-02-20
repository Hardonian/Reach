use crate::events::{EngineEvent, EventKind};
use crate::ir::{NodeKind, Workflow};
use crate::policy::{ExecutionPolicy, PolicyError};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MachineState {
    Idle,
    Running { current: String, transitions: usize },
    Paused { current: String, transitions: usize },
    Cancelled,
    Completed,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MachineError {
    InvalidWorkflow(String),
    NodeMissing(String),
    PolicyViolation(PolicyError),
    NoSuccessor(String),
    InvalidStateTransition(String),
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

    /// Pause the machine. Only valid when running.
    pub fn pause(&mut self) -> Result<EngineEvent, MachineError> {
        match &self.state {
            MachineState::Running {
                current,
                transitions,
            } => {
                self.state = MachineState::Paused {
                    current: current.clone(),
                    transitions: *transitions,
                };
                self.next_event(EventKind::Paused)
            }
            _ => Err(MachineError::InvalidStateTransition(format!(
                "cannot pause from {:?}",
                self.state
            ))),
        }
    }

    /// Resume the machine. Only valid when paused.
    pub fn resume(&mut self) -> Result<EngineEvent, MachineError> {
        match &self.state {
            MachineState::Paused {
                current,
                transitions,
            } => {
                self.state = MachineState::Running {
                    current: current.clone(),
                    transitions: *transitions,
                };
                self.next_event(EventKind::Resumed)
            }
            _ => Err(MachineError::InvalidStateTransition(format!(
                "cannot resume from {:?}",
                self.state
            ))),
        }
    }

    /// Cancel the machine. Valid from Running or Paused states.
    pub fn cancel(&mut self) -> Result<EngineEvent, MachineError> {
        match &self.state {
            MachineState::Running { .. } | MachineState::Paused { .. } => {
                self.state = MachineState::Cancelled;
                self.next_event(EventKind::Cancelled)
            }
            _ => Err(MachineError::InvalidStateTransition(format!(
                "cannot cancel from {:?}",
                self.state
            ))),
        }
    }

    pub fn step(&mut self) -> Result<EngineEvent, MachineError> {
        let (current, transitions) = match &self.state {
            MachineState::Running {
                current,
                transitions,
            } => (current.clone(), *transitions),
            MachineState::Idle => return self.start(),
            MachineState::Completed => return self.next_event(EventKind::Completed),
            MachineState::Paused { .. } => {
                return Err(MachineError::InvalidStateTransition(
                    "cannot step while paused".to_string(),
                ));
            }
            MachineState::Cancelled => {
                return Err(MachineError::InvalidStateTransition(
                    "cannot step after cancellation".to_string(),
                ));
            }
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
            MachineState::Running { current, .. } | MachineState::Paused { current, .. } => {
                current.clone()
            }
            MachineState::Completed => "completed".to_string(),
            MachineState::Cancelled => "cancelled".to_string(),
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

    #[test]
    fn pause_and_resume() {
        let mut machine = WorkflowMachine::new(sample_workflow(), ExecutionPolicy::default())
            .expect("construct");

        let _ = machine.start().expect("start ok");

        let pause_event = machine.pause().expect("pause should succeed");
        assert_eq!(pause_event.kind, crate::events::EventKind::Paused);
        assert!(matches!(machine.state(), MachineState::Paused { .. }));

        // Cannot step while paused
        assert!(matches!(
            machine.step(),
            Err(MachineError::InvalidStateTransition(_))
        ));

        let resume_event = machine.resume().expect("resume should succeed");
        assert_eq!(resume_event.kind, crate::events::EventKind::Resumed);
        assert!(matches!(machine.state(), MachineState::Running { .. }));

        // Can step after resume
        let _ = machine.step().expect("step after resume should work");
    }

    #[test]
    fn cancel_from_running() {
        let mut machine = WorkflowMachine::new(sample_workflow(), ExecutionPolicy::default())
            .expect("construct");

        let _ = machine.start().expect("start ok");

        let cancel_event = machine.cancel().expect("cancel should succeed");
        assert_eq!(cancel_event.kind, crate::events::EventKind::Cancelled);
        assert_eq!(cancel_event.node_id, "cancelled");
        assert!(matches!(machine.state(), MachineState::Cancelled));

        // Cannot step after cancel
        assert!(matches!(
            machine.step(),
            Err(MachineError::InvalidStateTransition(_))
        ));
    }

    #[test]
    fn cancel_from_paused() {
        let mut machine = WorkflowMachine::new(sample_workflow(), ExecutionPolicy::default())
            .expect("construct");

        let _ = machine.start().expect("start ok");
        let _ = machine.pause().expect("pause ok");

        let cancel_event = machine.cancel().expect("cancel from paused should work");
        assert_eq!(cancel_event.kind, crate::events::EventKind::Cancelled);
        assert!(matches!(machine.state(), MachineState::Cancelled));
    }

    #[test]
    fn cannot_pause_when_idle() {
        let mut machine = WorkflowMachine::new(sample_workflow(), ExecutionPolicy::default())
            .expect("construct");

        assert!(matches!(
            machine.pause(),
            Err(MachineError::InvalidStateTransition(_))
        ));
    }

    #[test]
    fn cannot_resume_when_running() {
        let mut machine = WorkflowMachine::new(sample_workflow(), ExecutionPolicy::default())
            .expect("construct");

        let _ = machine.start().expect("start ok");

        assert!(matches!(
            machine.resume(),
            Err(MachineError::InvalidStateTransition(_))
        ));
    }
}
