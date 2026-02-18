use engine_core::invariants::{
    canonical_hash, delegation_registry_snapshot_hash_preserved, deterministic_event_logs_match,
    pack_signature_matches_canonical_hash, policy_gate_rejects_undeclared_tools,
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
fn policy_gate_must_reject_undeclared_tools_every_time() {
    let declared_tools = ["tool.echo", "tool.search"];
    assert!(policy_gate_rejects_undeclared_tools(
        &declared_tools,
        &["tool.echo"]
    ));
    assert!(!policy_gate_rejects_undeclared_tools(
        &declared_tools,
        &["tool.exec"]
    ));
    assert!(!policy_gate_rejects_undeclared_tools(
        &declared_tools,
        &["tool.echo", "tool.exec"]
    ));
}

#[test]
fn delegated_runs_must_preserve_registry_snapshot_hash() {
    assert!(delegation_registry_snapshot_hash_preserved(
        "snapshot-a",
        "snapshot-a"
    ));
    assert!(!delegation_registry_snapshot_hash_preserved(
        "snapshot-a",
        "snapshot-b"
    ));
}

#[test]
fn replay_must_fail_if_snapshot_mismatched() {
    assert!(replay_fails_on_snapshot_mismatch("hash-a", "hash-a"));
    assert!(!replay_fails_on_snapshot_mismatch("hash-a", "hash-b"));
}
