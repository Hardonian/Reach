use serde::Serialize;
use blake3::Hasher;
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
    let mut hasher = Hasher::new();
    hasher.update(data.as_bytes());
    hasher.finalize().to_hex().to_string()
}