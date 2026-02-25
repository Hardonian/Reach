use engine_core::decision::determinism::compute_fingerprint;
use serde_json::json;

fn main() {
    println!("=== Rust Fingerprints ===");

    let test_cases = vec![
        ("simple_object", json!({ "a": 1, "b": 2 })),
        ("object_different_key_order", json!({ "b": 2, "a": 1 })),
        ("object_with_float", json!({ "x": 0.1, "y": 0.2 })),
        ("object_with_noisy_float", json!({ "z": 0.1 + 0.2 })),
        ("simple_array", json!([1, 2, 3])),
        ("nested_object", json!({ "foo": { "bar": "baz", "qux": 123 } })),
        ("null_boolean_string", json!({ "null": null, "bool": true, "str": "test" })),
        ("empty_object", json!({})),
        ("empty_array", json!([])),
    ];

    for (name, value) in test_cases {
        let fp = compute_fingerprint(&value);
        println!("{}: {}", name, fp);
    }
}
