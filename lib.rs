pub mod determinism;
pub mod engine;
pub mod types;

use wasm_bindgen::prelude::*;
use crate::types::{DecisionInput, DecisionOutput};
use crate::engine::{minimax_regret, maximin, weighted_sum, softmax, hurwicz, laplace, starr};
use crate::determinism::CanonicalJson;

#[wasm_bindgen]
pub fn evaluate_decision(input_json: &str) -> Result<String, JsError> {
    // 1. Parse Input (Strict)
    let mut input: DecisionInput = serde_json::from_str(input_json)
        .map_err(|e| JsError::new(&format!("E_SCHEMA: Invalid input JSON: {}", e)))?;

    // 2. Normalize (if not strict)
    if !input.strict {
        input.normalize_weights();
    }

    // 3. Validate
    input.validate()
        .map_err(|e| JsError::new(&format!("E_INVALID_INPUT: {}", e)))?;

    // 3. Execute Engine (Minimax Regret)
    let mut output = match input.algorithm.as_deref() {
        Some("maximin") => maximin(&input),
        Some("weighted_sum") => weighted_sum(&input),
        Some("softmax") => softmax(&input),
        Some("hurwicz") => hurwicz(&input),
        Some("laplace") => laplace(&input),
        Some("starr") => starr(&input),
        _ => minimax_regret(&input),
    }
        .map_err(|e| JsError::new(&format!("E_INTERNAL: Engine failure: {}", e)))?;

    // 4. Compute Deterministic Fingerprint
    // We hash the canonical form of the output (excluding the fingerprint itself initially)
    let canonical_output = output.to_canonical_json()
        .map_err(|e| JsError::new(&format!("E_INTERNAL: Serialization failure: {}", e)))?;
    
    let fingerprint = determinism::compute_hash(&canonical_output);
    output.trace.fingerprint = Some(fingerprint);

    // 5. Return Final JSON
    let final_json = output.to_canonical_json()
        .map_err(|e| JsError::new(&format!("E_INTERNAL: Final serialization failure: {}", e)))?;

    Ok(final_json)
}

#[wasm_bindgen]
pub fn validate_outcomes(input_json: &str) -> Result<bool, JsError> {
    let input: DecisionInput = serde_json::from_str(input_json)
        .map_err(|e| JsError::new(&format!("E_SCHEMA: Invalid input JSON: {}", e)))?;
    
    match input.validate_outcomes() {
        Ok(_) => Ok(true),
        Err(e) => Err(JsError::new(&format!("E_INVALID_OUTCOMES: {}", e))),
    }
}

#[wasm_bindgen]
pub fn validate_structure(input_json: &str) -> Result<bool, JsError> {
    let input: DecisionInput = serde_json::from_str(input_json)
        .map_err(|e| JsError::new(&format!("E_SCHEMA: Invalid input JSON: {}", e)))?;
    
    match input.validate_structure() {
        Ok(_) => Ok(true),
        Err(e) => Err(JsError::new(&format!("E_INVALID_STRUCTURE: {}", e))),
    }
}

#[wasm_bindgen]
pub fn validate_probabilities(input_json: &str) -> Result<bool, JsError> {
    let input: DecisionInput = serde_json::from_str(input_json)
        .map_err(|e| JsError::new(&format!("E_SCHEMA: Invalid input JSON: {}", e)))?;
    
    match input.validate_probabilities() {
        Ok(_) => Ok(true),
        Err(e) => Err(JsError::new(&format!("E_INVALID_PROBABILITIES: {}", e))),
    }
}

#[wasm_bindgen(start)]
pub fn init() {
    // Optional initialization hook
}