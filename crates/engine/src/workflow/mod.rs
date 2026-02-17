use serde::{Deserialize, Serialize};

use crate::{artifacts::Patch, tools::ToolSpec};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Workflow {
    pub id: String,
    pub version: String,
    pub steps: Vec<Step>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Step {
    pub id: StepId,
    pub kind: StepKind,
}

pub type StepId = String;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StepKind {
    ToolCall {
        tool: ToolSpec,
        #[serde(default)]
        input: serde_json::Value,
    },
    EmitArtifact {
        patch: Patch,
    },
}
