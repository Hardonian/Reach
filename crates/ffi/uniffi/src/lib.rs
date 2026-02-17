use engine::artifacts::ArtifactRef;

#[must_use]
pub fn artifact_is_valid(key: &str, checksum: &str, bytes: u64) -> bool {
    ArtifactRef::new(key, checksum, bytes).is_valid()
}

#[cfg(test)]
mod tests {
    use super::artifact_is_valid;

    #[test]
    fn wrapper_forwards_to_engine() {
        assert!(artifact_is_valid("k", "sum", 1));
        assert!(!artifact_is_valid("", "", 0));
    }
}
