use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CapsuleManifest {
    pub version: String,
    pub run_id: String,
    pub created_at: String,
    pub files: Vec<String>,
}

impl CapsuleManifest {
    #[must_use]
    pub fn deterministic(run_id: &str) -> Self {
        Self {
            version: "0.1.0".into(),
            run_id: run_id.into(),
            created_at: "1970-01-01T00:00:00Z".into(),
            files: vec![
                "manifest.json".into(),
                "events.ndjson".into(),
                "toolcalls.ndjson".into(),
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::CapsuleManifest;
    #[test]
    fn deterministic_manifest() {
        let m = CapsuleManifest::deterministic("run-1");
        assert_eq!(m.created_at, "1970-01-01T00:00:00Z");
    }
}
