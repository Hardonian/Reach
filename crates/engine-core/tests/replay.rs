use engine_core::{DeterministicEvent, ReplayState};

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
