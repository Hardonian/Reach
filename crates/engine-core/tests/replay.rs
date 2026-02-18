use engine_core::invariants::canonical_hash;
use engine_core::{DeterministicEvent, ReplayInvariantError, ReplayState, SignedPack};

#[test]
fn replay_is_deterministic() {
    let source = vec![
        DeterministicEvent {
            sequence: 1,
            event_type: "run_started".into(),
        },
        DeterministicEvent {
            sequence: 2,
            event_type: "run_completed".into(),
        },
    ];
    let replayed = ReplayState::replay(&source);
    assert_eq!(replayed.events, source);
}

#[test]
fn replay_with_snapshot_guard_rejects_mismatch() {
    let source = vec![DeterministicEvent {
        sequence: 1,
        event_type: "run_started".into(),
    }];

    let err = ReplayState::replay_with_snapshot_guard(&source, "hash-a", "hash-b")
        .expect_err("snapshot mismatch must fail");
    assert_eq!(
        err,
        ReplayInvariantError::SnapshotHashMismatch {
            expected: "hash-a".into(),
            actual: "hash-b".into()
        }
    );
}

#[test]
fn signed_pack_runtime_guards_delegate_to_invariants() {
    let payload = br#"{"pack":"alpha","version":"1.0.0"}"#.to_vec();
    let signature = canonical_hash(&payload);
    let pack = SignedPack {
        canonical_payload: payload,
        signature,
    };

    assert!(pack.signature_matches_payload_hash());
    assert!(pack.allows_tools(&["tool.echo"], &["tool.echo", "tool.search"]));
    assert!(!pack.allows_tools(&["tool.exec"], &["tool.echo", "tool.search"]));
    assert!(pack.delegation_snapshot_matches("snapshot-a", "snapshot-a"));
    assert!(!pack.delegation_snapshot_matches("snapshot-a", "snapshot-b"));
}
