#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EngineEvent {
    pub sequence: u64,
    pub node_id: String,
    pub kind: EventKind,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EventKind {
    Entered,
    Completed,
    Denied,
}

impl EngineEvent {
    #[must_use]
    pub fn new(sequence: u64, node_id: impl Into<String>, kind: EventKind) -> Self {
        Self {
            sequence,
            node_id: node_id.into(),
            kind,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{EngineEvent, EventKind};

    #[test]
    fn new_event_is_deterministic() {
        let event = EngineEvent::new(7, "start", EventKind::Entered);

        assert_eq!(event.sequence, 7);
        assert_eq!(event.node_id, "start");
        assert_eq!(event.kind, EventKind::Entered);
    }
}
