use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// A deterministic workflow graph.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Workflow {
    pub id: String,
    pub start: String,
    pub nodes: BTreeMap<String, WorkflowNode>,
}

impl Workflow {
    #[must_use]
    pub fn node(&self, id: &str) -> Option<&WorkflowNode> {
        self.nodes.get(id)
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty() {
            return Err("workflow id must not be empty".to_string());
        }
        if self.start.is_empty() {
            return Err("workflow start must not be empty".to_string());
        }
        if !self.nodes.contains_key(&self.start) {
            return Err("workflow start node is missing".to_string());
        }

        for (id, node) in &self.nodes {
            if id.is_empty() {
                return Err("node id must not be empty".to_string());
            }
            if node
                .next
                .iter()
                .any(|target| !self.nodes.contains_key(target))
            {
                return Err(format!("node {id} points to a missing successor"));
            }
        }

        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowNode {
    pub kind: NodeKind,
    pub next: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum NodeKind {
    Task { name: String },
    Decision { expression: String },
    Terminal,
}

#[cfg(test)]
mod tests {
    use super::{NodeKind, Workflow, WorkflowNode};
    use std::collections::BTreeMap;

    #[test]
    fn validate_happy_path() {
        let nodes = BTreeMap::from([
            (
                "start".to_string(),
                WorkflowNode {
                    kind: NodeKind::Task {
                        name: "collect".to_string(),
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

        let workflow = Workflow {
            id: "wf-1".to_string(),
            start: "start".to_string(),
            nodes,
        };

        assert!(workflow.validate().is_ok());
    }

    #[test]
    fn validate_missing_successor_fails() {
        let nodes = BTreeMap::from([(
            "start".to_string(),
            WorkflowNode {
                kind: NodeKind::Terminal,
                next: vec!["missing".to_string()],
            },
        )]);

        let workflow = Workflow {
            id: "wf-1".to_string(),
            start: "start".to_string(),
            nodes,
        };

        assert_eq!(
            workflow.validate(),
            Err("node start points to a missing successor".to_string())
        );
    }
}
