use engine::artifacts::ArtifactRef;

#[unsafe(no_mangle)]
pub extern "C" fn engine_c_abi_version() -> u32 {
    1
}

#[unsafe(no_mangle)]
pub extern "C" fn engine_c_abi_artifact_is_valid(bytes: u64) -> bool {
    let artifact = ArtifactRef::new("ffi", "ffi", bytes);
    artifact.is_valid()
}

#[cfg(test)]
mod tests {
    use super::{engine_c_abi_artifact_is_valid, engine_c_abi_version};

    #[test]
    fn exposes_stable_version() {
        assert_eq!(engine_c_abi_version(), 1);
    }

    #[test]
    fn validates_via_engine() {
        assert!(engine_c_abi_artifact_is_valid(0));
    }
}
