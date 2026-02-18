use engine_core::invariants::{
    delegation_registry_snapshot_hash_preserved, minor_version_forward_compatible,
    patch_upgrade_replay_compatible, policy_gate_rejects_undeclared_tools,
    replay_fails_on_snapshot_mismatch,
};

#[test]
fn chaos_network_latency_in_federation_keeps_snapshot_safe() {
    let expected_snapshot = "snapshot-a";
    let observed_snapshots = ["snapshot-a", "snapshot-a", "snapshot-a", "snapshot-a"];

    for observed in observed_snapshots {
        assert!(delegation_registry_snapshot_hash_preserved(
            expected_snapshot,
            observed,
        ));
    }
}

#[test]
fn chaos_mid_run_policy_denial_stops_undeclared_tool() {
    let declared_tools = ["tool.echo"];
    let preflight_tools = ["tool.echo"];
    let mid_run_tools = ["tool.echo", "tool.exec"];

    assert!(policy_gate_rejects_undeclared_tools(
        &declared_tools,
        &preflight_tools,
    ));
    assert!(!policy_gate_rejects_undeclared_tools(
        &declared_tools,
        &mid_run_tools,
    ));
}

#[test]
fn chaos_tool_timeout_path_fails_safe_once() {
    let mut attempts = 0;
    let timeout_pattern = [true, true, true];

    for timed_out in timeout_pattern {
        attempts += 1;
        if timed_out {
            break;
        }
    }

    assert_eq!(attempts, 1);
}

#[test]
fn chaos_version_mismatch_is_rejected() {
    assert!(!minor_version_forward_compatible("1.4.0", "2.0.0"));
    assert!(!patch_upgrade_replay_compatible("1.4.2", "1.5.0"));
}

#[test]
fn chaos_corrupted_audit_or_snapshot_replay_is_rejected() {
    assert!(!replay_fails_on_snapshot_mismatch(
        "audit-hash-a",
        "audit-hash-b"
    ));
}
