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
    pub fn evaluate(&self, requested: Capability) -> Decision {
        self.rules
            .iter()
            .find(|rule| rule.capability == requested)
            .map_or(Decision::Allow, |rule| {
                if rule.allow {
                    Decision::Allow
                } else {
                    Decision::Deny(
                        rule.reason
                            .clone()
                            .unwrap_or_else(|| "capability denied".to_owned()),
                    )
                }
            })
    }
}
