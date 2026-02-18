use crate::DeterministicEvent;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

#[must_use]
pub fn canonical_hash(payload: &[u8]) -> String {
    let mut hasher = DefaultHasher::new();
    payload.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

#[must_use]
pub fn pack_signature_matches_canonical_hash(signature: &str, canonical_payload: &[u8]) -> bool {
    signature == canonical_hash(canonical_payload)
}

#[must_use]
pub fn deterministic_event_logs_match(
    left: &[DeterministicEvent],
    right: &[DeterministicEvent],
) -> bool {
    left == right
}

#[must_use]
pub fn policy_gate_rejects_undeclared_tools(
    declared_tools: &[&str],
    requested_tools: &[&str],
) -> bool {
    requested_tools
        .iter()
        .all(|tool| declared_tools.iter().any(|declared| declared == tool))
}

#[must_use]
pub fn delegation_registry_snapshot_hash_preserved(
    expected_snapshot_hash: &str,
    delegated_snapshot_hash: &str,
) -> bool {
    expected_snapshot_hash == delegated_snapshot_hash
}

#[must_use]
pub fn replay_fails_on_snapshot_mismatch(
    expected_snapshot_hash: &str,
    replay_snapshot_hash: &str,
) -> bool {
    expected_snapshot_hash == replay_snapshot_hash
}

#[must_use]
pub fn minor_version_forward_compatible(current: &str, candidate: &str) -> bool {
    let (current_major, current_minor, _) = parse_semver(current);
    let (candidate_major, candidate_minor, _) = parse_semver(candidate);
    current_major == candidate_major && candidate_minor >= current_minor
}

#[must_use]
pub fn patch_upgrade_replay_compatible(source: &str, target: &str) -> bool {
    let (source_major, source_minor, _) = parse_semver(source);
    let (target_major, target_minor, _) = parse_semver(target);
    source_major == target_major && source_minor == target_minor
}

fn parse_semver(version: &str) -> (u32, u32, u32) {
    let mut segments = version.split('.');
    let major = segments
        .next()
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or_default();
    let minor = segments
        .next()
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or_default();
    let patch = segments
        .next()
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or_default();
    (major, minor, patch)
}
