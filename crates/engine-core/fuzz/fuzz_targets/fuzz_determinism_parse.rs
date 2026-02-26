//! Fuzz target for determinism parsing
//!
//! This fuzz target tests the parsing of deterministic events
//! to ensure no crashes or panics occur with malformed input.

#![no_main]

use libfuzzer_sys::fuzz_target;
use engine_core::decision::types::{DecisionInput, DecisionOutput};
use serde_json;

fuzz_target!(|data: &[u8]| {
    // Test that we can parse valid JSON into DecisionInput
    if let Ok(input) = serde_json::from_slice::<DecisionInput>(data) {
        // Test serialization roundtrip
        let serialized = serde_json::to_vec(&input);
        if let Ok(serialized) = serialized {
            let _ = serde_json::from_slice::<DecisionInput>(&serialized);
        }
    }

    // Test that we can parse valid JSON into DecisionOutput
    if let Ok(output) = serde_json::from_slice::<DecisionOutput>(data) {
        // Test serialization roundtrip
        let serialized = serde_json::to_vec(&output);
        if let Ok(serialized) = serialized {
            let _ = serde_json::from_slice::<DecisionOutput>(&serialized);
        }
    }
});
