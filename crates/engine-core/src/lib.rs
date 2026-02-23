pub mod decision;
pub mod invariants;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fmt::{Display, Formatter};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeterministicEvent {
    pub sequence: u64,
    pub event_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayState {
    pub events: Vec<DeterministicEvent>,
}

impl ReplayState {
    #[must_use]
    pub fn replay(events: &[DeterministicEvent]) -> Self {
        let replayed = Self {
            events: events.to_vec(),
        };
        debug_assert!(invariants::deterministic_event_logs_match(
            events,
            &replayed.events,
        ));
        replayed
    }

    pub fn replay_with_snapshot_guard(
        events: &[DeterministicEvent],
        expected_snapshot_hash: &str,
        replay_snapshot_hash: &str,
    ) -> Result<Self, ReplayInvariantError> {
        if !invariants::replay_fails_on_snapshot_mismatch(
            expected_snapshot_hash,
            replay_snapshot_hash,
        ) {
            return Err(ReplayInvariantError::SnapshotHashMismatch {
                expected: expected_snapshot_hash.to_owned(),
                actual: replay_snapshot_hash.to_owned(),
            });
        }
        Ok(Self::replay(events))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignedPack {
    pub canonical_payload: Vec<u8>,
    pub signature: String,
}

impl SignedPack {
    #[must_use]
    pub fn signature_matches_payload_hash(&self) -> bool {
        invariants::pack_signature_matches_canonical_hash(&self.signature, &self.canonical_payload)
    }

    #[must_use]
    pub fn allows_tools(&self, requested_tools: &[&str], declared_tools: &[&str]) -> bool {
        invariants::policy_gate_rejects_undeclared_tools(declared_tools, requested_tools)
    }

    #[must_use]
    pub fn delegation_snapshot_matches(
        &self,
        expected_snapshot_hash: &str,
        delegated_snapshot_hash: &str,
    ) -> bool {
        invariants::delegation_registry_snapshot_hash_preserved(
            expected_snapshot_hash,
            delegated_snapshot_hash,
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReplayInvariantError {
    SnapshotHashMismatch { expected: String, actual: String },
}

impl Display for ReplayInvariantError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::SnapshotHashMismatch { expected, actual } => {
                write!(
                    f,
                    "replay snapshot hash mismatch: expected {expected}, got {actual}"
                )
            }
        }
    }
}

impl Error for ReplayInvariantError {}
