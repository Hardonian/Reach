//! Fuzz target for fingerprint/hashing operations
//!
//! This fuzz target tests the fingerprinting and hashing operations
//! to ensure no crashes or panics occur with various inputs.

#![no_main]

use libfuzzer_sys::fuzz_target;
use engine_core::decision::determinism;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct TestFingerprintInput {
    data: Vec<u8>,
    context: Option<String>,
}

fuzz_target!(|data: &[u8]| {
    // Test that fingerprinting various inputs doesn't panic
    let _ = determinism::fingerprint_bytes(data);

    // Test with various string inputs
    if let Ok(s) = std::str::from_utf8(data) {
        let _ = determinism::fingerprint_string(s);
    }

    // Test fingerprinting with different contexts
    if let Ok(input) = serde_json::from_slice::<TestFingerprintInput>(data) {
        let mut hasher = sha2::Sha256::new();
        hasher.update(&input.data);
        if let Some(ctx) = input.context {
            hasher.update(ctx.as_bytes());
        }
        let _ = hasher.finalize();
    }
});
