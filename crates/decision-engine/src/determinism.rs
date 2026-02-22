//! Determinism utilities for byte-stable serialization.
//!
//! This module provides the core determinism guarantees:
//! - **Float normalization**: Fixed precision (1e-9) for deterministic numeric comparison
//! - **Canonical JSON**: Sorted keys, normalized floats, no undefined values
//! - **Stable hashing**: SHA-256 fingerprinting of canonical bytes

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

/// Precision for float normalization (1e-9).
pub const FLOAT_PRECISION: f64 = 1e-9;

/// Normalize a float to fixed precision for deterministic comparison.
///
/// This eliminates floating-point noise by rounding to a fixed number
/// of decimal places (9 digits after the decimal point).
///
/// # Example
///
/// ```
/// use decision_engine::determinism::float_normalize;
///
/// let noisy = 0.1 + 0.2; // Not exactly 0.3 in IEEE 754
/// let normalized = float_normalize(noisy);
/// assert!((normalized - 0.3).abs() < 1e-9);
/// ```
pub fn float_normalize(value: f64) -> f64 {
    if value.is_nan() {
        return 0.0; // NaN is not deterministic, convert to 0
    }
    if value.is_infinite() {
        if value > 0.0 {
            return f64::MAX;
        } else {
            return f64::MIN;
        }
    }
    (value / FLOAT_PRECISION).round() * FLOAT_PRECISION
}

/// Internal representation for canonical JSON values.
#[derive(Debug, Clone, PartialEq)]
enum CanonicalValue {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<CanonicalValue>),
    Object(BTreeMap<String, CanonicalValue>),
}

impl CanonicalValue {
    /// Convert to a JSON-like string representation.
    fn to_canonical_string(&self) -> String {
        match self {
            CanonicalValue::Null => "null".to_string(),
            CanonicalValue::Bool(b) => b.to_string(),
            CanonicalValue::Number(n) => {
                // Format number with fixed precision
                let normalized = float_normalize(*n);
                if normalized.fract() == 0.0 {
                    format!("{}", normalized as i64)
                } else {
                    format!("{}", normalized)
                }
            }
            CanonicalValue::String(s) => {
                // Escape special characters
                let escaped = s
                    .replace('\\', "\\\\")
                    .replace('"', "\\\"")
                    .replace('\n', "\\n")
                    .replace('\r', "\\r")
                    .replace('\t', "\\t");
                format!("\"{}\"", escaped)
            }
            CanonicalValue::Array(arr) => {
                let items: Vec<String> = arr.iter().map(|v| v.to_canonical_string()).collect();
                format!("[{}]", items.join(","))
            }
            CanonicalValue::Object(obj) => {
                // Keys are already sorted by BTreeMap
                let items: Vec<String> = obj
                    .iter()
                    .map(|(k, v)| {
                        let key = CanonicalValue::String(k.clone()).to_canonical_string();
                        format!("{}:{}", key, v.to_canonical_string())
                    })
                    .collect();
                format!("{{{}}}", items.join(","))
            }
        }
    }
}

impl From<&serde_json::Value> for CanonicalValue {
    fn from(value: &serde_json::Value) -> Self {
        match value {
            serde_json::Value::Null => CanonicalValue::Null,
            serde_json::Value::Bool(b) => CanonicalValue::Bool(*b),
            serde_json::Value::Number(n) => {
                CanonicalValue::Number(n.as_f64().unwrap_or(0.0))
            }
            serde_json::Value::String(s) => CanonicalValue::String(s.clone()),
            serde_json::Value::Array(arr) => {
                CanonicalValue::Array(arr.iter().map(CanonicalValue::from).collect())
            }
            serde_json::Value::Object(obj) => {
                let mut map: BTreeMap<String, CanonicalValue> = BTreeMap::new();
                for (k, v) in obj {
                    map.insert(k.clone(), CanonicalValue::from(v));
                }
                CanonicalValue::Object(map)
            }
        }
    }
}

/// Produce canonical JSON bytes from a serializable value.
///
/// The canonical form ensures:
/// - Object keys are sorted lexicographically
/// - Floats are normalized to fixed precision
/// - No undefined values (converted to null if needed)
/// - No trailing whitespace
///
/// # Example
///
/// ```
/// use decision_engine::determinism::canonical_json;
/// use serde_json::json;
///
/// let value = json!({
///     "zebra": 1,
///     "apple": 2,
///     "mango": 0.1 + 0.2  // Float noise
/// });
///
/// let bytes = canonical_json(&value);
/// // Keys are sorted: apple, mango, zebra
/// // Float is normalized: 0.3
/// ```
pub fn canonical_json<T: Serialize>(value: &T) -> Vec<u8> {
    // First serialize to serde_json::Value
    let json_value = serde_json::to_value(value).unwrap_or(serde_json::Value::Null);

    // Convert to canonical form
    let canonical = CanonicalValue::from(&json_value);

    // Produce canonical string
    canonical.to_canonical_string().into_bytes()
}

/// Compute SHA-256 hash of bytes, returning hex-encoded string.
///
/// # Example
///
/// ```
/// use decision_engine::determinism::stable_hash;
///
/// let bytes = b"hello world";
/// let hash = stable_hash(bytes);
/// assert_eq!(hash.len(), 64); // SHA-256 produces 64 hex chars
/// ```
pub fn stable_hash(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let result = hasher.finalize();
    hex::encode(result)
}

/// Compute deterministic fingerprint for a serializable value.
///
/// This produces a SHA-256 hash of the canonical JSON representation.
/// Identical inputs always produce identical fingerprints.
///
/// # Example
///
/// ```
/// use decision_engine::determinism::compute_fingerprint;
/// use serde_json::json;
///
/// let value1 = json!({"a": 1, "b": 2});
/// let value2 = json!({"b": 2, "a": 1}); // Same content, different key order
///
/// let fp1 = compute_fingerprint(&value1);
/// let fp2 = compute_fingerprint(&value2);
///
/// assert_eq!(fp1, fp2); // Same fingerprint despite different key order
/// ```
pub fn compute_fingerprint<T: Serialize>(value: &T) -> String {
    let bytes = canonical_json(value);
    stable_hash(&bytes)
}

/// Trait for types that can produce a determinism fingerprint.
pub trait DeterminismFingerprint {
    /// Compute the deterministic fingerprint.
    fn fingerprint(&self) -> String;
}

impl<T: Serialize> DeterminismFingerprint for T {
    fn fingerprint(&self) -> String {
        compute_fingerprint(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_float_normalize_basic() {
        assert!((float_normalize(1.0) - 1.0).abs() < 1e-12);
        assert!((float_normalize(0.5) - 0.5).abs() < 1e-12);
        assert!((float_normalize(-1.0) - (-1.0)).abs() < 1e-12);
    }

    #[test]
    fn test_float_normalize_noise() {
        let noisy = 0.1 + 0.2;
        let normalized = float_normalize(noisy);
        assert!((normalized - 0.3).abs() < 1e-9);
    }

    #[test]
    fn test_float_normalize_nan() {
        let normalized = float_normalize(f64::NAN);
        assert!((normalized - 0.0).abs() < 1e-12);
    }

    #[test]
    fn test_float_normalize_infinity() {
        let pos_inf = float_normalize(f64::INFINITY);
        let neg_inf = float_normalize(f64::NEG_INFINITY);

        assert!(pos_inf > 1e308);
        assert!(neg_inf < -1e308);
    }

    #[test]
    fn test_canonical_json_sorted_keys() {
        let value = json!({
            "zebra": 1,
            "apple": 2,
            "mango": 3
        });

        let bytes = canonical_json(&value);
        let s = String::from_utf8(bytes).unwrap();

        // Keys should appear in sorted order
        let apple_pos = s.find("apple").unwrap();
        let mango_pos = s.find("mango").unwrap();
        let zebra_pos = s.find("zebra").unwrap();

        assert!(apple_pos < mango_pos);
        assert!(mango_pos < zebra_pos);
    }

    #[test]
    fn test_canonical_json_normalized_floats() {
        let value = json!({
            "noisy": 0.1 + 0.2  // Not exactly 0.3 in IEEE 754
        });

        let bytes = canonical_json(&value);
        let s = String::from_utf8(bytes).unwrap();

        // Should contain normalized value
        assert!(s.contains("0.3"));
    }

    #[test]
    fn test_canonical_json_identical_for_same_content() {
        let value1 = json!({
            "zebra": 1,
            "apple": 2
        });

        let value2 = json!({
            "apple": 2,
            "zebra": 1
        });

        let bytes1 = canonical_json(&value1);
        let bytes2 = canonical_json(&value2);

        assert_eq!(bytes1, bytes2);
    }

    #[test]
    fn test_stable_hash_length() {
        let bytes = b"test data";
        let hash = stable_hash(bytes);

        assert_eq!(hash.len(), 64); // SHA-256 = 32 bytes = 64 hex chars
    }

    #[test]
    fn test_stable_hash_deterministic() {
        let bytes = b"test data";

        let hash1 = stable_hash(bytes);
        let hash2 = stable_hash(bytes);

        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_compute_fingerprint_deterministic() {
        let value = json!({"test": "data"});

        let fp1 = compute_fingerprint(&value);
        let fp2 = compute_fingerprint(&value);

        assert_eq!(fp1, fp2);
    }

    #[test]
    fn test_compute_fingerprint_key_order_independent() {
        let value1 = json!({"a": 1, "b": 2, "c": 3});
        let value2 = json!({"c": 3, "a": 1, "b": 2});

        let fp1 = compute_fingerprint(&value1);
        let fp2 = compute_fingerprint(&value2);

        assert_eq!(fp1, fp2);
    }

    #[test]
    fn test_compute_fingerprint_nested_objects() {
        let value1 = json!({
            "outer": {
                "z": 1,
                "a": 2
            }
        });

        let value2 = json!({
            "outer": {
                "a": 2,
                "z": 1
            }
        });

        let fp1 = compute_fingerprint(&value1);
        let fp2 = compute_fingerprint(&value2);

        assert_eq!(fp1, fp2);
    }

    #[test]
    fn test_compute_fingerprint_arrays() {
        // Arrays are NOT reordered (order matters)
        let value1 = json!({"arr": [1, 2, 3]});
        let value2 = json!({"arr": [3, 2, 1]});

        let fp1 = compute_fingerprint(&value1);
        let fp2 = compute_fingerprint(&value2);

        assert_ne!(fp1, fp2); // Different order = different fingerprint
    }

    #[test]
    fn test_determinism_fingerprint_trait() {
        let value = json!({"test": 123});
        let fp = value.fingerprint();

        assert_eq!(fp.len(), 64);
    }
}