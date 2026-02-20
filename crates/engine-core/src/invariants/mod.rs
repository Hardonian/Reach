use crate::DeterministicEvent;

/// FNV-1a 64-bit offset basis.
const FNV_OFFSET: u64 = 0xcbf29ce484222325;
/// FNV-1a 64-bit prime.
const FNV_PRIME: u64 = 0x00000100000001B3;

/// Computes a deterministic FNV-1a hash of the payload.
///
/// Unlike `std::collections::hash_map::DefaultHasher`, this hash function
/// is portable across platforms and compiler versions, making it safe for
/// canonical hashing in replay and integrity verification.
#[must_use]
pub fn canonical_hash(payload: &[u8]) -> String {
    let mut hash = FNV_OFFSET;
    for &byte in payload {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    format!("{hash:016x}")
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
    let (Ok((current_major, current_minor, _)), Ok((candidate_major, candidate_minor, _))) =
        (parse_semver(current), parse_semver(candidate))
    else {
        // Malformed versions are never compatible.
        return false;
    };
    current_major == candidate_major && candidate_minor >= current_minor
}

#[must_use]
pub fn patch_upgrade_replay_compatible(source: &str, target: &str) -> bool {
    let (Ok((source_major, source_minor, _)), Ok((target_major, target_minor, _))) =
        (parse_semver(source), parse_semver(target))
    else {
        return false;
    };
    source_major == target_major && source_minor == target_minor
}

/// Errors from semantic version parsing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SemverError {
    /// The version string does not have exactly three dot-separated segments.
    BadFormat,
    /// A segment is not a valid unsigned integer.
    InvalidSegment,
}

/// Parses a semver string into (major, minor, patch).
///
/// Returns `Err` for any input that is not exactly three dot-separated unsigned
/// integers, preventing silent version mismatches.
fn parse_semver(version: &str) -> Result<(u32, u32, u32), SemverError> {
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() != 3 {
        return Err(SemverError::BadFormat);
    }
    let major = parts[0].parse::<u32>().map_err(|_| SemverError::InvalidSegment)?;
    let minor = parts[1].parse::<u32>().map_err(|_| SemverError::InvalidSegment)?;
    let patch = parts[2].parse::<u32>().map_err(|_| SemverError::InvalidSegment)?;
    Ok((major, minor, patch))
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
        assert_eq!(parse_semver("1.2.3"), Ok((1, 2, 3)));
    }

    #[test]
    fn parse_semver_invalid_returns_error() {
        assert_eq!(parse_semver("abc.def.xyz"), Err(SemverError::InvalidSegment));
        assert_eq!(parse_semver("1.2"), Err(SemverError::BadFormat));
        assert_eq!(parse_semver(""), Err(SemverError::BadFormat));
    }

    #[test]
    fn malformed_versions_are_never_compatible() {
        assert!(!minor_version_forward_compatible("bad", "1.2.3"));
        assert!(!minor_version_forward_compatible("1.2.3", "bad"));
        assert!(!patch_upgrade_replay_compatible("1.2", "1.2.3"));
    }
}
