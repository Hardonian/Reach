use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::{
    artifacts::Patch,
    tools::{ToolCall, ToolResult},
    workflow::StepId,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum RunStatus {
    Created,
    Running,
    Completed,
    Failed { reason: String },
}

#[derive(Debug, Error)]
pub enum StateTransitionError {
    #[error("invalid transition from {from:?} to {to:?}")]
    Invalid { from: RunStatus, to: RunStatus },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RunEvent {
    RunCreated,
    RunStarted,
    ToolCallRequested {
        step_id: StepId,
        call: ToolCall,
    },
    ToolCallCompleted {
        step_id: StepId,
        result: ToolResult,
    },
    PolicyDenied {
        step_id: StepId,
        call: ToolCall,
        reason: String,
    },
    ArtifactEmitted {
        step_id: StepId,
        patch: Patch,
    },
    RunCompleted,
    RunFailed {
        reason: String,
    },
}

impl RunStatus {
    pub fn transition(&self, target: &RunStatus) -> Result<RunEvent, StateTransitionError> {
        match (self, target) {
            (Self::Created, Self::Running) => Ok(RunEvent::RunStarted),
            (Self::Running, Self::Completed) => Ok(RunEvent::RunCompleted),
            (Self::Running, Self::Failed { reason }) => Ok(RunEvent::RunFailed {
                reason: reason.clone(),
            }),
            (from, to) => Err(StateTransitionError::Invalid {
                from: from.clone(),
                to: to.clone(),
            }),
        }
    }
}
