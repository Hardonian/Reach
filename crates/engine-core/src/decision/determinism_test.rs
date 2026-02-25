use super::determinism::{canonical_json, compute_fingerprint};
use serde_json::json;
use std::fs::File;
use std::io::Read;

#[test]
fn test_golden_vectors() {
    // Read the test vectors from the JSON file
    let mut file = File::open("determinism.vectors.json").expect("Failed to open test vectors file");
    let mut content = String::new();
    file.read_to_string(&mut content).expect("Failed to read test vectors file");
    let vectors: Vec<serde_json::Value> = serde_json::from_str(&content).expect("Failed to parse test vectors");

    for vector in vectors {
        let name = vector["name"].as_str().unwrap_or("unknown");
        let input = &vector["input"];
        let expected_rust_fingerprint = vector["expected_rust_fingerprint"].as_str();

        let fingerprint = compute_fingerprint(input);
        println!("Vector: {} -> Fingerprint: {}", name, fingerprint);

        // If expected_rust_fingerprint is not null, compare with computed value
        if let Some(expected) = expected_rust_fingerprint {
            if expected != "" {
                assert_eq!(
                    fingerprint, expected,
                    "Test vector '{}' failed: expected '{}', got '{}'",
                    name, expected, fingerprint
                );
            }
        }
    }
}

#[test]
fn test_simple_vector() {
    let test_vector = json!({
        "name": "simple_test",
        "input": {"a": 1, "b": 2},
        "expected_rust_fingerprint": "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
        "expected_ts_fingerprint": "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
        "notes": "Simple object test case"
    });

    let name = test_vector["name"].as_str().unwrap_or("unknown");
    let input = &test_vector["input"];
    let expected_rust_fingerprint = test_vector["expected_rust_fingerprint"].as_str().unwrap();

    let fingerprint = compute_fingerprint(input);
    assert_eq!(
        fingerprint, expected_rust_fingerprint,
        "Test vector '{}' failed: expected '{}', got '{}'",
        name, expected_rust_fingerprint, fingerprint
    );
}

#[test]
fn test_vector_sanity() {
    // These tests assume that the TypeScript and Rust implementations
    // produce identical fingerprints for inputs without floating-point numbers
    let test_cases = vec![
        (
            "simple_object",
            json!({ "a": 1, "b": 2 }),
            "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777"
        ),
        (
            "object_different_key_order",
            json!({ "b": 2, "a": 1 }),
            "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777"
        ),
        (
            "nested_object",
            json!({ "foo": { "bar": "baz", "qux": 123 } }),
            "8050b6c315fdc79b6972fdf4ef1266f2ca59f95e59b183a3078cc8767e48207e"
        ),
        (
            "null_boolean_string",
            json!({ "null": null, "bool": true, "str": "test" }),
            "44515fe56b1643ed521caa8f5eed09146869ff87cd94ef90532a4dbd885bd190"
        ),
        (
            "empty_object",
            json!({}),
            "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
        ),
        (
            "empty_array",
            json!([]),
            "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
        ),
    ];

    for (name, input, expected) in test_cases {
        let actual = compute_fingerprint(&input);
        assert_eq!(
            actual, expected,
            "Test case '{}' failed: expected '{}', got '{}'",
            name, expected, actual
        );
    }
}
