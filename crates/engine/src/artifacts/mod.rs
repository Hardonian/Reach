use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Diff {
    pub path: String,
    pub before: String,
    pub after: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Patch {
    pub diffs: Vec<Diff>,
}

impl Patch {
    #[must_use]
    pub fn apply_to(&self, source_path: &str, source_content: &str) -> Option<String> {
        self.diffs
            .iter()
            .find(|diff| diff.path == source_path && diff.before == source_content)
            .map(|diff| diff.after.clone())
    }
}
