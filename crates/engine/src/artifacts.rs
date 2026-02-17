#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArtifactRef {
    pub key: String,
    pub checksum: String,
    pub bytes: u64,
}

impl ArtifactRef {
    #[must_use]
    pub fn new(key: impl Into<String>, checksum: impl Into<String>, bytes: u64) -> Self {
        Self {
            key: key.into(),
            checksum: checksum.into(),
            bytes,
        }
    }

    #[must_use]
    pub fn is_valid(&self) -> bool {
        !self.key.is_empty() && !self.checksum.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::ArtifactRef;

    #[test]
    fn validates_non_empty_fields() {
        let artifact = ArtifactRef::new("build/output", "abc123", 32);
        assert!(artifact.is_valid());

        let invalid = ArtifactRef::new("", "", 0);
        assert!(!invalid.is_valid());
    }
}
