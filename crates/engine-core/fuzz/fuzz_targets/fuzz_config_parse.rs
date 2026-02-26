//! Fuzz target for configuration parsing
//!
//! This fuzz target tests the parsing of configuration data
//! to ensure no crashes or panics occur with malformed input.

#![no_main]

use libfuzzer_sys::fuzz_target;
use engine_core::DeterministicEvent;
use serde_json;

fuzz_target!(|data: &[u8]| {
    // Test that we can parse valid JSON into DeterministicEvent
    if let Ok(event) = serde_json::from_slice::<DeterministicEvent>(data) {
        // Test serialization roundtrip
        let serialized = serde_json::to_vec(&event);
        if let Ok(serialized) = serialized {
            let _ = serde_json::from_slice::<DeterministicEvent>(&serialized);
        }
    }

    // Test that we can parse arrays of DeterministicEvent
    if let Ok(events) = serde_json::from_slice::<Vec<DeterministicEvent>>(data) {
        // Test serialization roundtrip
        let serialized = serde_json::to_vec(&events);
        if let Ok(serialized) = serialized {
            let _ = serde_json::from_slice::<Vec<DeterministicEvent>>(&serialized);
        }
    }
});
