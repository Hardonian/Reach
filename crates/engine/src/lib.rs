pub mod artifacts;
pub mod policy;
pub mod state;
pub mod tools;
pub mod workflow;

use std::collections::VecDeque;

use anyhow::Context;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::policy::{Capability, Decision, Policy};
use crate::state::{RunEvent, RunStatus, StateTransitionError};
use crate::tools::{ToolCall, ToolResult};
use crate::workflow::{StepKind, Workflow};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EngineConfig {
    pub strict_schema: bool,
}

#[derive(Debug, Clone)]
pub struct Engine {
    config: EngineConfig,
}

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("workflow parse failed: {0}")]
    Parse(String),
    #[error("state transition failed: {0}")]
    Transition(#[from] StateTransitionError),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunHandle {
    workflow: Workflow,
    policy: Policy,
    status: RunStatus,
    current_step: usize,
    pending_events: VecDeque<RunEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Action {
    ToolCall(ToolCall),
    EmitArtifact(crate::artifacts::Patch),
    Done,
    Error { message: String },
}

impl Engine {
    #[must_use]
    pub fn new(config: EngineConfig) -> Self {
        Self { config }
    }

    pub fn compile(&self, workflow_dsl_or_json: &str) -> Result<Workflow, EngineError> {
        serde_json::from_str::<Workflow>(workflow_dsl_or_json)
            .with_context(|| {
                if self.config.strict_schema {
                    "strict schema validation rejected workflow"
                } else {
                    "failed to parse workflow JSON"
                }
            })
            .map_err(|err| EngineError::Parse(err.to_string()))
    }

    pub fn start_run(&self, workflow: Workflow, policy: Policy) -> Result<RunHandle, EngineError> {
        let mut handle = RunHandle {
            workflow,
            policy,
            status: RunStatus::Created,
            current_step: 0,
            pending_events: VecDeque::new(),
        };
        handle.transition(RunStatus::Running)?;
        Ok(handle)
    }
}

impl RunHandle {
    #[must_use]
    pub fn status(&self) -> &RunStatus {
        &self.status
    }

    pub fn next_action(&mut self) -> Action {
        if matches!(self.status, RunStatus::Failed { .. }) {
            return Action::Error {
                message: "run already failed".to_owned(),
            };
        }
        if matches!(self.status, RunStatus::Completed) {
            return Action::Done;
        }

        let Some(step) = self.workflow.steps.get(self.current_step) else {
            if self.transition(RunStatus::Completed).is_err() {
                return Action::Error {
                    message: "unable to complete run".to_owned(),
                };
            }
            return Action::Done;
        };

        match &step.kind {
            StepKind::ToolCall { tool, input } => {
                let decision = self.policy.evaluate(Capability::ToolUse {
                    name: tool.name.clone(),
                });
                match decision {
                    Decision::Allow => {
                        self.pending_events.push_back(RunEvent::ToolCallRequested {
                            step_id: step.id.clone(),
                            call: ToolCall {
                                step_id: step.id.clone(),
                                tool_name: tool.name.clone(),
                                input: input.clone(),
                            },
                        });
                        Action::ToolCall(ToolCall {
                            step_id: step.id.clone(),
                            tool_name: tool.name.clone(),
                            input: input.clone(),
                        })
                    }
                    Decision::Deny(reason) => {
                        let message = format!("policy denied tool call {}: {reason}", tool.name);
                        let _ = self.transition(RunStatus::Failed {
                            reason: message.clone(),
                        });
                        Action::Error { message }
                    }
                }
            }
            StepKind::EmitArtifact { patch } => {
                self.pending_events.push_back(RunEvent::ArtifactEmitted {
                    step_id: step.id.clone(),
                    patch: patch.clone(),
                });
                self.current_step += 1;
                Action::EmitArtifact(patch.clone())
            }
        }
    }

    pub fn apply_tool_result(&mut self, tool_result: ToolResult) -> Result<(), EngineError> {
        if !matches!(self.status, RunStatus::Running) {
            return Err(EngineError::Transition(StateTransitionError::Invalid {
                from: self.status.clone(),
                to: RunStatus::Running,
            }));
        }

        self.pending_events.push_back(RunEvent::ToolCallCompleted {
            step_id: tool_result.step_id.clone(),
            result: tool_result,
        });
        self.current_step += 1;
        Ok(())
    }

    #[must_use]
    pub fn drain_events(&mut self) -> Vec<RunEvent> {
        self.pending_events.drain(..).collect()
    }

    fn transition(&mut self, target: RunStatus) -> Result<(), StateTransitionError> {
        let event = self.status.transition(&target)?;
        self.status = target;
        self.pending_events.push_back(event);
        Ok(())
    }
}
