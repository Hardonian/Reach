use serde::{Deserialize, Serialize};

use crate::{artifacts::Patch, tools::ToolSpec};

/// Maximum length for any identifier (workflow id, step id, tool name).
const MAX_ID_LEN: usize = 256;

/// Returns `true` if `id` is a well-formed identifier: non-empty, at most
/// [`MAX_ID_LEN`] bytes, and contains only ASCII alphanumerics, hyphens, or
/// underscores.
fn is_valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_ID_LEN
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Workflow {
    pub id: String,
    pub version: String,
    pub steps: Vec<Step>,
}

impl Workflow {
    /// Validates structural invariants: all identifiers are well-formed and
    /// tool names contain only safe characters.
    pub fn validate(&self) -> Result<(), String> {
        if !is_valid_id(&self.id) {
            return Err(format!(
                "workflow id must be 1-{MAX_ID_LEN} ASCII alphanumeric/hyphen/underscore chars"
            ));
        }
        for step in &self.steps {
            if !is_valid_id(&step.id) {
                return Err(format!(
                    "step id must be 1-{MAX_ID_LEN} ASCII alphanumeric/hyphen/underscore chars"
                ));
            }
            if let StepKind::ToolCall { tool, .. } = &step.kind {
                if !is_valid_tool_name(&tool.name) {
                    return Err(format!(
                        "tool name must be 1-{MAX_ID_LEN} ASCII alphanumeric/dot/hyphen/underscore chars"
                    ));
                }
            }
        }
        Ok(())
    }
}

/// Tool names additionally allow dots (e.g. `namespace.tool_name`).
fn is_valid_tool_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_ID_LEN
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.')
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
