//! Golden vector tests for determinism module.
//!
//! These tests verify that the Rust implementation produces the same fingerprints
//! as the TypeScript implementation for the same inputs.

use super::determinism;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;

/// Test vector structure matching the JSON file
#[derive(Debug, Clone, Serialize, Deserialize)]
struct TestVector {
    name: String,
    input: serde_json::Value,
    expected_ts_fingerprint: String,
    expected_rust_fingerprint: Option<String>,
    notes: String,
}

/// Load test vectors from the determinism.vectors.json file
fn load_test_vectors() -> Vec<TestVector> {
    // Try multiple possible paths for the test vectors file
    let possible_paths = [
        "determinism.vectors.json",
        "../../determinism.vectors.json",
        "../../../determinism.vectors.json",
    ];

    let mut content = String::new();
    let mut found = false;

    for path in &possible_paths {
        if let Ok(mut file) = File::open(path) {
            if file.read_to_string(&mut content).is_ok() {
                found = true;
                break;
            }
        }
    }

    if !found {
        // Try to find from CARGO_MANIFEST_DIR
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let path = std::path::Path::new(&manifest_dir).join("../../determinism.vectors.json");
            if let Ok(mut file) = File::open(&path) {
                let _ = file.read_to_string(&mut content);
                found = true;
            }
        }
    }

    if !found {
        panic!("Could not find determinism.vectors.json file");
    }

    serde_json::from_str(&content).expect("Failed to parse test vectors JSON")
}

#[test]
fn test_golden_vectors_compute_fingerprints() {
    let vectors = load_test_vectors();
    assert!(!vectors.is_empty(), "Test vectors should not be empty");

    println!("Loaded {} test vectors", vectors.len());

    for vector in &vectors {
        // Compute fingerprint using Rust implementation
        let fingerprint = determinism::compute_fingerprint(&vector.input);

        println!(
            "Test vector '{}': Computed fingerprint = {}",
            vector.name, fingerprint
        );

        // Verify fingerprint format (64 hex characters)
        assert_eq!(
            fingerprint.len(),
            64,
            "Fingerprint should be 64 hex characters for vector {}",
            vector.name
        );

        // If there's an expected Rust fingerprint, verify it matches
        if let Some(expected) = &vector.expected_rust_fingerprint {
            assert_eq!(
                fingerprint, *expected,
                "Rust fingerprint mismatch for vector {} ({})",
                vector.name, vector.notes
            );
        }

        // For non-float inputs, Rust should match TypeScript fingerprint
        // Float inputs may differ due to different normalization strategies
        if !has_float_values(&vector.input) {
            assert_eq!(
                fingerprint, vector.expected_ts_fingerprint,
                "Cross-language fingerprint mismatch for vector {} ({}). \
                 Rust and TypeScript should produce identical fingerprints for non-float inputs.",
                vector.name, vector.notes
            );
        }
    }
}

#[test]
fn test_golden_vector_determinism() {
    let vectors = load_test_vectors();

    for vector in &vectors {
        // Compute fingerprint twice to verify determinism
        let fp1 = determinism::compute_fingerprint(&vector.input);
        let fp2 = determinism::compute_fingerprint(&vector.input);

        assert_eq!(
            fp1, fp2,
            "Fingerprints should be deterministic for vector {}",
            vector.name
        );
    }
}

#[test]
fn test_key_order_independence() {
    // Test that objects with different key orders produce same fingerprint
    let input1 = serde_json::json!({
        "z": 1,
        "a": 2,
        "m": 3
    });

    let input2 = serde_json::json!({
        "a": 2,
        "m": 3,
        "z": 1
    });

    let fp1 = determinism::compute_fingerprint(&input1);
    let fp2 = determinism::compute_fingerprint(&input2);

    assert_eq!(
        fp1, fp2,
        "Fingerprints should be independent of key order"
    );
}

/// Check if a JSON value contains any float numbers
fn has_float_values(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Number(n) => {
            // Check if it's a float (has decimal part or is explicitly a float)
            n.as_f64().is_some() && !n.as_i64().is_some()
        }
        serde_json::Value::Array(arr) => arr.iter().any(has_float_values),
        serde_json::Value::Object(obj) => obj.values().any(has_float_values),
        _ => false,
    }
}

/// Print computed fingerprints for updating the JSON file
/// Run with: cargo test test_print_fingerprints -- --nocapture
#[test]
#[ignore = "Use this test to update the golden vectors file"]
fn test_print_fingerprints() {
    let vectors = load_test_vectors();

    println!("\n=== Computed Fingerprints for Golden Vectors ===\n");
    for vector in &vectors {
        let fingerprint = determinism::compute_fingerprint(&vector.input);
        println!("Vector: {}", vector.name);
        println!("  Input: {}", serde_json::to_string(&vector.input).unwrap());
        println!("  TS fingerprint:  {}", vector.expected_ts_fingerprint);
        println!("  Rust fingerprint: {}", fingerprint);
        println!();
    }
}
