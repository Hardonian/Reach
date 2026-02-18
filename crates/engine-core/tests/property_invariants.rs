use engine_core::invariants::{
    deterministic_event_logs_match, minor_version_forward_compatible,
    patch_upgrade_replay_compatible,
};
use engine_core::DeterministicEvent;

fn semver_string(major: u32, minor: u32, patch: u32) -> String {
    format!("{major}.{minor}.{patch}")
}

fn lcg_next(seed: u64) -> u64 {
    seed.wrapping_mul(6364136223846793005).wrapping_add(1)
}

fn generate_event_log(seed: u64, len: usize) -> Vec<DeterministicEvent> {
    let mut state = seed;
    let mut events = Vec::with_capacity(len);
    for sequence in 0..len {
        state = lcg_next(state);
        let variant = (state % 4) as usize;
        let event_type =
            ["run_started", "tool_called", "tool_result", "run_completed"][variant].to_owned();
        events.push(DeterministicEvent {
            sequence: sequence as u64,
            event_type,
        });
    }
    events
}

#[test]
fn fuzz_event_log_invariant_reflexive_and_mutation_sensitive() {
    for seed in 0_u64..512 {
        let len = (seed as usize % 32) + 1;
        let events = generate_event_log(seed, len);
        assert!(deterministic_event_logs_match(&events, &events));

        let mut mutated = events.clone();
        mutated[0].event_type.push_str("_mutated");
        assert!(!deterministic_event_logs_match(&events, &mutated));
    }
}

#[test]
fn fuzz_semver_minor_forward_compatibility() {
    for major in 0_u32..10 {
        for current_minor in 0_u32..20 {
            for candidate_minor in 0_u32..20 {
                let current = semver_string(major, current_minor, 3);
                let candidate = semver_string(major, candidate_minor, 0);
                let expected = candidate_minor >= current_minor;
                assert_eq!(
                    minor_version_forward_compatible(&current, &candidate),
                    expected,
                    "current={current} candidate={candidate}"
                );
            }
        }
    }
}

#[test]
fn fuzz_semver_patch_replay_compatibility() {
    for major in 0_u32..10 {
        for minor in 0_u32..20 {
            for source_patch in 0_u32..10 {
                for target_patch in 0_u32..10 {
                    let source = semver_string(major, minor, source_patch);
                    let target = semver_string(major, minor, target_patch);
                    assert!(patch_upgrade_replay_compatible(&source, &target));

                    let different_minor = semver_string(major, minor + 1, target_patch);
                    assert!(!patch_upgrade_replay_compatible(&source, &different_minor));

                    let different_major = semver_string(major + 1, minor, target_patch);
                    assert!(!patch_upgrade_replay_compatible(&source, &different_major));
                }
            }
        }
    }
}
