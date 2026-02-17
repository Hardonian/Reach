use serde::{Deserialize, Serialize};

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
        Self {
            events: events.to_vec(),
        }
    }
}
