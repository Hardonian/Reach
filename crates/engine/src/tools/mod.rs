use serde::{Deserialize, Serialize};

use crate::policy::Capability;
use crate::workflow::StepId;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolSpec {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
    pub output_schema: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolCall {
    pub step_id: StepId,
    pub tool_name: String,
    pub required_capabilities: Vec<Capability>,
    pub input: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolResult {
    pub step_id: StepId,
    pub tool_name: String,
    pub output: serde_json::Value,
    pub success: bool,
    pub error: Option<String>,
}
