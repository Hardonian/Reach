use std::collections::BTreeMap;

/// Maximum length for any identifier (workflow id, node id, task name).
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

/// A deterministic workflow graph.
#[derive(Clone, Debug, PartialEq, Eq)]
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
        if !is_valid_id(&self.id) {
            return Err(format!(
                "workflow id must be 1-{MAX_ID_LEN} ASCII alphanumeric/hyphen/underscore chars"
            ));
        }
        if !is_valid_id(&self.start) {
            return Err(format!(
                "workflow start must be 1-{MAX_ID_LEN} ASCII alphanumeric/hyphen/underscore chars"
            ));
        }
        if !self.nodes.contains_key(&self.start) {
            return Err("workflow start node is missing".to_string());
        }

        for (id, node) in &self.nodes {
            if !is_valid_id(id) {
                return Err(format!(
                    "node id must be 1-{MAX_ID_LEN} ASCII alphanumeric/hyphen/underscore chars"
                ));
            }
            for target in &node.next {
                if !self.nodes.contains_key(target) {
                    return Err(format!("node {id} points to a missing successor"));
                }
            }
        }

        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WorkflowNode {
    pub kind: NodeKind,
    pub next: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
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
    fn validate_rejects_invalid_ids() {
        let nodes = BTreeMap::from([(
            "start".to_string(),
            WorkflowNode {
                kind: NodeKind::Terminal,
                next: vec![],
            },
        )]);

        // Spaces in workflow id
        let wf = Workflow {
            id: "bad id".to_string(),
            start: "start".to_string(),
            nodes: nodes.clone(),
        };
        assert!(wf.validate().is_err());

        // Empty workflow id
        let wf = Workflow {
            id: "".to_string(),
            start: "start".to_string(),
            nodes: nodes.clone(),
        };
        assert!(wf.validate().is_err());
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
