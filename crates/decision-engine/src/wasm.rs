//! WASM bindings for the decision engine.
//!
//! This module provides a WebAssembly interface for the decision engine,
//! enabling use from JavaScript/TypeScript with full determinism guarantees.
//!
//! ## Usage
//!
//! ```javascript
//! const wasm = await import('./decision_engine.js');
//!
//! const input = {
//!   id: "test",
//!   actions: [{ id: "buy", label: "Buy" }],
//!   scenarios: [{ id: "bull", probability: 0.5, adversarial: false }],
//!   outcomes: [["buy", "bull", 100]]
//! };
//!
//! const result = wasm.evaluate_decision_json(JSON.stringify(input));
//! const output = JSON.parse(result);
//! console.log(output.ranked_actions[0].action_id);
//! ```

use crate::engine::evaluate_decision;
use crate::types::DecisionInput;
use serde::{Deserialize, Serialize};

/// WASM-compatible error response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmError {
    pub ok: bool,
    pub error: ErrorDetail,
}

/// Error detail structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

impl WasmError {
    /// Create a new WASM error.
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            ok: false,
            error: ErrorDetail {
                code: code.to_string(),
                message: message.to_string(),
                details: None,
            },
        }
    }

    /// Create a WASM error with details.
    pub fn with_details(code: &str, message: &str, details: serde_json::Value) -> Self {
        Self {
            ok: false,
            error: ErrorDetail {
                code: code.to_string(),
                message: message.to_string(),
                details: Some(details),
            },
        }
    }

    /// Convert to JSON string.
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| {
            r#"{"ok":false,"error":{"code":"E_INTERNAL","message":"Failed to serialize error"}}"#
                .to_string()
        })
    }
}

/// WASM-compatible success response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmSuccess<T> {
    pub ok: bool,
    pub data: T,
}

impl<T: Serialize> WasmSuccess<T> {
    /// Create a new WASM success response.
    pub fn new(data: T) -> Self {
        Self { ok: true, data }
    }

    /// Convert to JSON string.
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| {
            r#"{"ok":false,"error":{"code":"E_INTERNAL","message":"Failed to serialize response"}}"#
                .to_string()
        })
    }
}

/// Evaluate a decision from JSON input string.
///
/// This is the main WASM entry point. It accepts a JSON string representing
/// a DecisionInput and returns a JSON string with the result.
///
/// # Arguments
///
/// * `input_json` - JSON string representing a DecisionInput
///
/// # Returns
///
/// JSON string with either:
/// - Success: `{"ok": true, "data": {...DecisionOutput...}}`
/// - Error: `{"ok": false, "error": {"code": "...", "message": "..."}}`
///
/// # Error Codes
///
/// - `E_SCHEMA`: Invalid JSON schema (malformed JSON or missing required fields)
/// - `E_INVALID_INPUT`: Invalid input values (e.g., empty actions, invalid probabilities)
/// - `E_INTERNAL`: Internal error (should not happen in normal operation)
///
/// # Example (JavaScript)
///
/// ```javascript
/// const input = {
///   actions: [{ id: "buy", label: "Buy" }],
///   scenarios: [{ id: "bull", probability: 1.0, adversarial: false }],
///   outcomes: [["buy", "bull", 100]]
/// };
///
/// const result = evaluate_decision_json(JSON.stringify(input));
/// const output = JSON.parse(result);
///
/// if (output.ok) {
///   console.log("Recommended:", output.data.ranked_actions[0].action_id);
/// } else {
///   console.error("Error:", output.error.code, output.error.message);
/// }
/// ```
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn evaluate_decision_json(input_json: &str) -> String {
    evaluate_decision_json_impl(input_json)
}

/// Non-WASM version of evaluate_decision_json for testing.
#[cfg(not(target_arch = "wasm32"))]
pub fn evaluate_decision_json(input_json: &str) -> String {
    evaluate_decision_json_impl(input_json)
}

/// Implementation shared between WASM and native.
fn evaluate_decision_json_impl(input_json: &str) -> String {
    // Parse input JSON
    let input: DecisionInput = match serde_json::from_str(input_json) {
        Ok(i) => i,
        Err(e) => {
            let error = WasmError::with_details(
                "E_SCHEMA",
                &format!("Failed to parse input JSON: {}", e),
                serde_json::json!({
                    "parse_error": e.to_string()
                }),
            );
            return error.to_json();
        }
    };

    // Evaluate decision
    match evaluate_decision(&input) {
        Ok(output) => {
            let success = WasmSuccess::new(output);
            success.to_json()
        }
        Err(e) => {
            let error = WasmError::new(
                "E_INVALID_INPUT",
                &e.to_string(),
            );
            error.to_json()
        }
    }
}

/// Compute fingerprint for a decision input JSON string.
///
/// # Arguments
///
/// * `input_json` - JSON string representing a DecisionInput
///
/// # Returns
///
/// JSON string with either:
/// - Success: `{"ok": true, "data": {"fingerprint": "..."}}`
/// - Error: `{"ok": false, "error": {...}}`
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn compute_fingerprint_json(input_json: &str) -> String {
    compute_fingerprint_json_impl(input_json)
}

/// Non-WASM version for testing.
#[cfg(not(target_arch = "wasm32"))]
pub fn compute_fingerprint_json(input_json: &str) -> String {
    compute_fingerprint_json_impl(input_json)
}

fn compute_fingerprint_json_impl(input_json: &str) -> String {
    // Parse input JSON
    let input: DecisionInput = match serde_json::from_str(input_json) {
        Ok(i) => i,
        Err(e) => {
            let error = WasmError::with_details(
                "E_SCHEMA",
                &format!("Failed to parse input JSON: {}", e),
                serde_json::json!({
                    "parse_error": e.to_string()
                }),
            );
            return error.to_json();
        }
    };

    // Compute fingerprint
    let fingerprint = crate::determinism::compute_fingerprint(&input);
    
    let success = WasmSuccess::new(serde_json::json!({
        "fingerprint": fingerprint
    }));
    success.to_json()
}

/// Get the engine version.
///
/// # Returns
///
/// JSON string: `{"ok": true, "data": {"version": "0.2.0"}}`
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn get_engine_version() -> String {
    get_engine_version_impl()
}

#[cfg(not(target_arch = "wasm32"))]
pub fn get_engine_version() -> String {
    get_engine_version_impl()
}

fn get_engine_version_impl() -> String {
    let success = WasmSuccess::new(serde_json::json!({
        "version": env!("CARGO_PKG_VERSION")
    }));
    success.to_json()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_evaluate_decision_json_valid() {
        let input = r#"{
            "actions": [{"id": "buy", "label": "Buy"}],
            "scenarios": [{"id": "bull", "probability": 1.0, "adversarial": false}],
            "outcomes": [["buy", "bull", 100]]
        }"#;

        let result = evaluate_decision_json(input);
        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();

        assert!(parsed["ok"].as_bool().unwrap());
        assert!(parsed["data"]["ranked_actions"].is_array());
        assert_eq!(parsed["data"]["ranked_actions"][0]["action_id"], "buy");
    }

    #[test]
    fn test_evaluate_decision_json_invalid_schema() {
        let input = r#"{"invalid": "data"}"#;

        let result = evaluate_decision_json(input);
        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();

        assert!(!parsed["ok"].as_bool().unwrap());
        assert_eq!(parsed["error"]["code"], "E_SCHEMA");
    }

    #[test]
    fn test_evaluate_decision_json_invalid_input() {
        let input = r#"{
            "actions": [],
            "scenarios": [],
            "outcomes": []
        }"#;

        let result = evaluate_decision_json(input);
        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();

        assert!(!parsed["ok"].as_bool().unwrap());
        assert_eq!(parsed["error"]["code"], "E_INVALID_INPUT");
    }

    #[test]
    fn test_compute_fingerprint_json() {
        let input = r#"{
            "actions": [{"id": "a", "label": "A"}],
            "scenarios": [{"id": "s", "probability": 1.0, "adversarial": false}],
            "outcomes": [["a", "s", 10]]
        }"#;

        let result = compute_fingerprint_json(input);
        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();

        assert!(parsed["ok"].as_bool().unwrap());
        assert_eq!(parsed["data"]["fingerprint"].as_str().unwrap().len(), 64);
    }

    #[test]
    fn test_get_engine_version() {
        let result = get_engine_version();
        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();

        assert!(parsed["ok"].as_bool().unwrap());
        assert!(parsed["data"]["version"].is_string());
    }

    #[test]
    fn test_deterministic_output() {
        let input = r#"{
            "actions": [{"id": "buy", "label": "Buy"}, {"id": "sell", "label": "Sell"}],
            "scenarios": [{"id": "bull", "probability": 0.5}, {"id": "bear", "probability": 0.5}],
            "outcomes": [["buy", "bull", 100], ["buy", "bear", -50], ["sell", "bull", -20], ["sell", "bear", 20]]
        }"#;

        let result1 = evaluate_decision_json(input);
        let result2 = evaluate_decision_json(input);

        assert_eq!(result1, result2);
    }
}
