use engine_core::invariants::{
    delegation_registry_snapshot_hash_preserved, minor_version_forward_compatible,
    patch_upgrade_replay_compatible,
};

#[test]
fn supports_minor_version_forward_compatibility() {
    assert!(minor_version_forward_compatible("1.3.0", "1.4.0"));
    assert!(minor_version_forward_compatible("1.3.0", "1.3.9"));
    assert!(!minor_version_forward_compatible("1.3.0", "2.0.0"));
}

#[test]
fn replay_pack_remains_stable_across_patch_upgrades() {
    assert!(patch_upgrade_replay_compatible("1.7.0", "1.7.3"));
    assert!(!patch_upgrade_replay_compatible("1.7.0", "1.8.0"));
}

#[test]
fn registry_snapshot_mismatch_is_detected() {
    assert!(delegation_registry_snapshot_hash_preserved(
        "registry-hash-a",
        "registry-hash-a",
    ));
    assert!(!delegation_registry_snapshot_hash_preserved(
        "registry-hash-a",
        "registry-hash-b",
    ));
}
