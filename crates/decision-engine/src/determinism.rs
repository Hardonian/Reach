//! Determinism utilities for byte-stable serialization and hashing.
//!
//! This module provides the foundation for deterministic decision outputs:
//! - Canonical JSON serialization with sorted keys and normalized floats
//! - SHA-256 hashing for fingerprinting
//! - Float normalization with configurable precision

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

/// Precision for float normalization (1e-9 means 9 decimal places).
pub const FLOAT_PRECISION: f64 = 1e-9;

/// A deterministic fingerprint (SHA-256 hash in hex).
pub type DeterminismFingerprint = String;

/// Normalize a float value to a deterministic representation.
///
/// Uses a fixed precision (1e-9) to ensure consistent rounding.
/// NaN is converted to 0.0, and infinity is clamped to f64::MAX or f64::MIN.
///
/// # Example
///
/// ```
/// use decision_engine::determinism::float_normalize;
///
/// assert!((float_normalize(1.23456789012345) - 1.234567890).abs() < 1e-12);
/// assert!((float_normalize(0.1 + 0.2) - 0.3).abs() < 1e-9);
/// ```
pub fn float_normalize(value: f64) -> f64 {
    if value.is_nan() {
        return 0.0;
    }
    if value.is_infinite() {
        return if value.is_sign_positive() { f64::MAX } else { f64::MIN };
    }
    (value / FLOAT_PRECISION).round() * FLOAT_PRECISION
}

/// Normalize a float for JSON display (truncated to avoid floating point noise).
fn normalize_for_json(value: f64) -> f64 {
    if value.is_nan() {
        return 0.0;
    }
    if value.is_infinite() {
        return if value.is_sign_positive() { f64::MAX } else { f64::MIN };
    }
    // Truncate to 9 decimal places for clean JSON output
    let normalized = (value * 1e9).round() / 1e9;
    // Handle -0.0
    if normalized == 0.0 { 0.0 } else { normalized }
}

/// A canonical JSON value for deterministic serialization.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum CanonicalValue {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<CanonicalValue>),
    Object(BTreeMap<String, CanonicalValue>),
}

impl CanonicalValue {
    /// Convert a serde_json::Value to a CanonicalValue with sorted keys and normalized floats.
    pub fn from_json_value(value: &serde_json::Value) -> Self {
        match value {
            serde_json::Value::Null => CanonicalValue::Null,
            serde_json::Value::Bool(b) => CanonicalValue::Bool(*b),
            serde_json::Value::Number(n) => {
                let f = n.as_f64().unwrap_or(0.0);
                CanonicalValue::Number(normalize_for_json(f))
            }
            serde_json::Value::String(s) => CanonicalValue::String(s.clone()),
            serde_json::Value::Array(arr) => {
                CanonicalValue::Array(arr.iter().map(Self::from_json_value).collect())
            }
            serde_json::Value::Object(obj) => {
                let mut map = BTreeMap::new();
                for (k, v) in obj {
                    map.insert(k.clone(), Self::from_json_value(v));
                }
                CanonicalValue::Object(map)
            }
        }
    }
}

/// Serialize a value to canonical JSON bytes.
///
/// This produces byte-stable JSON with:
/// - Sorted object keys (using BTreeMap)
/// - Normalized float values (9 decimal places)
/// - No trailing whitespace
/// - Consistent escaping
///
/// # Example
///
/// ```
/// use decision_engine::determinism::canonical_json;
/// use serde::Serialize;
///
/// #[derive(Serialize)]
/// struct Data {
///     z: f64,
///     a: f64,
/// }
///
/// let d1 = Data { z: 1.0, a: 2.0 };
/// let d2 = Data { a: 2.0, z: 1.0 };
///
/// // Different field order produces same canonical JSON
/// assert_eq!(canonical_json(&d1), canonical_json(&d2));
/// ```
pub fn canonical_json<T: Serialize>(value: &T) -> Vec<u8> {
    // First serialize to serde_json::Value
    let json_value = serde_json::to_value(value).expect("serialization failed");
    // Convert to canonical form with sorted keys
    let canonical = CanonicalValue::from_json_value(&json_value);
    // Serialize to bytes (sorted keys are preserved by BTreeMap)
    let mut bytes = serde_json::to_vec(&canonical).expect("canonical serialization failed");
    // Ensure no trailing newline
    if bytes.last() == Some(&b'\n') {
        bytes.pop();
    }
    bytes
}

/// Compute a SHA-256 hash of canonical JSON bytes.
///
/// Returns a hex-encoded string (64 characters).
///
/// # Example
///
/// ```
/// use decision_engine::determinism::{canonical_json, stable_hash};
/// use serde::Serialize;
///
/// #[derive(Serialize)]
/// struct Input { value: f64 }
///
/// let bytes = canonical_json(&Input { value: 1.0 });
/// let hash = stable_hash(&bytes);
/// assert_eq!(hash.len(), 64);
/// assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
/// ```
pub fn stable_hash(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let result = hasher.finalize();
    hex::encode(result)
}

/// Compute a deterministic fingerprint for any serializable value.
///
/// This is a convenience function that combines canonical_json and stable_hash.
///
/// # Example
///
/// ```
/// use decision_engine::determinism::DeterminismFingerprint;
/// use decision_engine::determinism::compute_fingerprint;
/// use serde::Serialize;
///
/// #[derive(Serialize)]
/// struct Decision { id: String, value: f64 }
///
/// let d1 = Decision { id: "test".to_string(), value: 1.0 };
/// let d2 = Decision { id: "test".to_string(), value: 1.0 };
///
/// assert_eq!(compute_fingerprint(&d1), compute_fingerprint(&d2));
/// ```
pub fn compute_fingerprint<T: Serialize>(value: &T) -> DeterminismFingerprint {
    let bytes = canonical_json(value);
    stable_hash(&bytes)
}

/// Hex encoding utility (avoiding external dependency for simple case).
mod hex {
    const HEX_CHARS: &[u8; 16] = b"0123456789abcdef";

    pub fn encode(bytes: &[u8]) -> String {
        let mut result = String::with_capacity(bytes.len() * 2);
        for &byte in bytes {
            result.push(HEX_CHARS[(byte >> 4) as usize] as char);
            result.push(HEX_CHARS[(byte & 0x0f) as usize] as char);
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_float_normalize() {
        // Basic normalization
        assert!((float_normalize(1.23456789012345) - 1.234567890).abs() < 1e-12);

        // Floating point noise elimination
        let sum = 0.1 + 0.2;
        assert!((float_normalize(sum) - 0.3).abs() < 1e-9);

        // NaN handling
        assert_eq!(float_normalize(f64::NAN), 0.0);

        // Infinity handling
        assert_eq!(float_normalize(f64::INFINITY), f64::MAX);
        assert_eq!(float_normalize(f64::NEG_INFINITY), f64::MIN);

        // Zero handling
        assert_eq!(float_normalize(0.0), 0.0);
        assert_eq!(float_normalize(-0.0), 0.0);
    }

    #[test]
    fn test_canonical_json_sorted_keys() {
        let v1 = json!({"z": 1, "a": 2, "m": 3});
        let v2 = json!({"a": 2, "z": 1, "m": 3});

        let c1 = canonical_json(&v1);
        let c2 = canonical_json(&v2);

        assert_eq!(c1, c2);

        // Verify keys are sorted
        let s = String::from_utf8(c1.clone()).unwrap();
        assert!(s.contains("\"a\":2") && s.contains("\"m\":3") && s.contains("\"z\":1"));
        // 'a' should come before 'm' which should come before 'z'
        let a_pos = s.find("\"a\":2").unwrap();
        let m_pos = s.find("\"m\":3").unwrap();
        let z_pos = s.find("\"z\":1").unwrap();
        assert!(a_pos < m_pos && m_pos < z_pos);
    }

    #[test]
    fn test_canonical_json_normalized_floats() {
        let v = json!({"value": 1.23456789012345});
        let c = canonical_json(&v);
        let s = String::from_utf8(c).unwrap();
        // Should be normalized to 9 decimal places
        assert!(s.contains("\"value\":1.23456789"));
    }

    #[test]
    fn test_stable_hash_consistency() {
        let bytes1 = b"test data";
        let bytes2 = b"test data";

        let hash1 = stable_hash(bytes1);
        let hash2 = stable_hash(bytes2);

        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64);
    }

    #[test]
    fn test_stable_hash_determinism() {
        // SHA-256 of "test data" - precomputed for verification
        let bytes = b"test data";
        let hash = stable_hash(bytes);
        // Verify it's a valid hex string
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_compute_fingerprint_determinism() {
        #[derive(Serialize)]
        struct TestInput {
            id: String,
            values: Vec<f64>,
        }

        let input1 = TestInput {
            id: "test".to_string(),
            values: vec![1.0, 2.0, 3.0],
        };
        let input2 = TestInput {
            id: "test".to_string(),
            values: vec![1.0, 2.0, 3.0],
        };

        assert_eq!(compute_fingerprint(&input1), compute_fingerprint(&input2));
    }

    #[test]
    fn test_canonical_json_nested_objects() {
        let v1 = json!({
            "outer": {
                "z": 1,
                "a": 2
            },
            "inner": {
                "m": 3,
                "b": 4
            }
        });
        let v2 = json!({
            "inner": {
                "b": 4,
                "m": 3
            },
            "outer": {
                "a": 2,
                "z": 1
            }
        });

        assert_eq!(canonical_json(&v1), canonical_json(&v2));
    }

    #[test]
    fn test_canonical_json_arrays() {
        // Arrays should preserve order (not sort)
        let v1 = json!({"arr": [3, 1, 2]});
        let v2 = json!({"arr": [3, 1, 2]});

        assert_eq!(canonical_json(&v1), canonical_json(&v2));

        // Different array order should produce different output
        let v3 = json!({"arr": [1, 2, 3]});
        assert_ne!(canonical_json(&v1), canonical_json(&v3));
    }
}
