use engine_core::invariants::{
    canonical_hash, deterministic_event_logs_match, pack_signature_matches_canonical_hash,
    replay_fails_on_snapshot_mismatch,
};
use engine_core::DeterministicEvent;

#[test]
fn pack_signature_must_match_canonical_hash() {
    let payload = br#"{"pack":"alpha","version":"1.0.0"}"#;
    let signature = canonical_hash(payload);
    assert!(pack_signature_matches_canonical_hash(&signature, payload));
    assert!(!pack_signature_matches_canonical_hash("deadbeef", payload));
}

#[test]
fn deterministic_runs_must_produce_identical_event_logs() {
    let run_a = vec![
        DeterministicEvent {
            sequence: 1,
            event_type: "run_started".into(),
        },
        DeterministicEvent {
            sequence: 2,
            event_type: "run_completed".into(),
        },
    ];
    let run_b = run_a.clone();
    let run_c = vec![DeterministicEvent {
        sequence: 1,
        event_type: "run_failed".into(),
    }];

    assert!(deterministic_event_logs_match(&run_a, &run_b));
    assert!(!deterministic_event_logs_match(&run_a, &run_c));
}

#[test]
fn replay_must_fail_if_snapshot_mismatched() {
    assert!(replay_fails_on_snapshot_mismatch("hash-a", "hash-a"));
    assert!(!replay_fails_on_snapshot_mismatch("hash-a", "hash-b"));
}
