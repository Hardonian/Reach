use super::determinism;
use serde_json::json;
use std::fs::File;
use std::io::Read;

#[test]
fn test_golden_vectors() {
    // Read the test vectors from the JSON file
    let mut file = File::open("determinism.vectors.json").expect("Failed to open determinism.vectors.json");
    let mut content = String::new();
    file.read_to_string(&mut content).expect("Failed to read determinism.vectors.json");
    let vectors: serde_json::Value = serde_json::from_str(&content).expect("Failed to parse test vectors");

    if let Some(vectors_array) = vectors.as_array() {
        for vector in vectors_array {
            if let Some(name) = vector.get("name").and_then(|v| v.as_str()) {
                if let Some(input) = vector.get("input") {
                    // Compute fingerprint
                    let fingerprint = determinism::compute_fingerprint(input);
                    println!("Test vector '{}': Fingerprint = {}", name, fingerprint);

                    // For now, we're just checking that we can compute fingerprints
                    // In a future step, we'll compare against expected_rust_fingerprint
                    assert!(!fingerprint.is_empty());
                    assert_eq!(fingerprint.len(), 64); // SHA-256 hex string length
                }
            }
        }
    } else {
        panic!("Test vectors should be an array");
    }
}
