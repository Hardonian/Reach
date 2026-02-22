use serde::Serialize;
use sha2::{Sha256, Digest};
use anyhow::Result;

pub trait CanonicalJson {
    fn to_canonical_json(&self) -> Result<String>;
}

impl<T: Serialize> CanonicalJson for T {
    fn to_canonical_json(&self) -> Result<String> {
        // serde_json with "preserve_order" feature and BTreeMap (used in types)
        // ensures keys are sorted.
        // We use to_string for compact representation (no whitespace).
        serde_json::to_string(self).map_err(|e| e.into())
    }
}

pub fn compute_hash(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}