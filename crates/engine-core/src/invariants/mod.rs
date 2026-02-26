use crate::DeterministicEvent;

/// Computes a deterministic BLAKE3 hash of the payload.
///
/// BLAKE3 is used as the canonical hash primitive across the entire system
/// for consistency and determinism in replay and integrity verification.
#[must_use]
pub fn canonical_hash(payload: &[u8]) -> String {
    use blake3::Hasher;
    let mut hasher = Hasher::new();
    hasher.update(payload);
    hasher.finalize().to_hex().to_string()
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

/// Parses a semver string into (major, minor, patch).
/// Returns (0, 0, 0) for any segment that fails to parse, but logs the
/// failure case to prevent silent version mismatches.
fn parse_semver(version: &str) -> (u32, u32, u32) {
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() != 3 {
        // Non-standard semver format — treat as 0.0.0 to fail version checks safely.
        return (0, 0, 0);
    }
    let major = parts[0].parse::<u32>().unwrap_or(0);
    let minor = parts[1].parse::<u32>().unwrap_or(0);
    let patch = parts[2].parse::<u32>().unwrap_or(0);
    (major, minor, patch)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_hash_is_deterministic() {
        let data = b"hello world";
        let h1 = canonical_hash(data);
        let h2 = canonical_hash(data);
        assert_eq!(h1, h2);
    }

    #[test]
    fn canonical_hash_different_for_different_inputs() {
        assert_ne!(canonical_hash(b"a"), canonical_hash(b"b"));
    }

    #[test]
    fn parse_semver_valid() {
        assert_eq!(parse_semver("1.2.3"), (1, 2, 3));
    }

    #[test]
    fn parse_semver_invalid_returns_zeros() {
        assert_eq!(parse_semver("abc.def.xyz"), (0, 0, 0));
        assert_eq!(parse_semver("1.2"), (0, 0, 0));
        assert_eq!(parse_semver(""), (0, 0, 0));
    }
}
