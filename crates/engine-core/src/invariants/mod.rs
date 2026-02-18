use crate::DeterministicEvent;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub fn canonical_hash(payload: &[u8]) -> String {
    let mut hasher = DefaultHasher::new();
    payload.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

pub fn pack_signature_matches_canonical_hash(signature: &str, canonical_payload: &[u8]) -> bool {
    signature == canonical_hash(canonical_payload)
}

pub fn deterministic_event_logs_match(
    left: &[DeterministicEvent],
    right: &[DeterministicEvent],
) -> bool {
    left == right
}

pub fn replay_fails_on_snapshot_mismatch(
    expected_snapshot_hash: &str,
    replay_snapshot_hash: &str,
) -> bool {
    expected_snapshot_hash == replay_snapshot_hash
}
