# Canonicalization Specification

Last Updated: 2026-02-22

## Purpose

This document defines the authoritative canonicalization rules for the Decision Engine. All implementations (Rust, TypeScript, WASM) MUST follow these rules to ensure byte-stable deterministic outputs.

## Contract Source of Truth

The **Rust implementation at `crates/decision-engine/`** is the authoritative reference. All other implementations must produce identical outputs for identical inputs.

---

## 1. Deep Key Ordering

### 1.1 Object Keys

All object keys MUST be sorted lexicographically at every nesting level.

**Rule**: Use `BTreeMap` in Rust, sorted map traversal in TypeScript.

**Example**:
```json
// Input (any order)
{"zebra": 1, "apple": 2, "mango": 3}

// Canonical output (sorted)
{"apple": 2, "mango": 3, "zebra": 1}
```

### 1.2 Nested Objects

Sorting applies recursively to all nested objects.

**Example**:
```json
// Input
{"outer": {"z": 1, "a": 2}}

// Canonical output
{"outer": {"a": 2, "z": 1}}
```

### 1.3 Arrays

Arrays are NOT reordered. Array order is semantically significant.

**Example**:
```json
// These produce DIFFERENT fingerprints
{"arr": [1, 2, 3]}  // fingerprint A
{"arr": [3, 2, 1]}  // fingerprint B (different!)
```

---

## 2. Number Normalization

### 2.1 Precision

All floating-point numbers MUST be normalized to **1e-9 precision** (9 decimal places).

**Algorithm**:
```
normalized = round(value / 1e-9) * 1e-9
```

**Rust Implementation** (`crates/decision-engine/src/determinism.rs`):
```rust
pub const FLOAT_PRECISION: f64 = 1e-9;

pub fn float_normalize(value: f64) -> f64 {
    if value.is_nan() {
        return 0.0;
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
```

### 2.2 Special Values

| Input | Canonical Output |
|-------|------------------|
| `NaN` | `0.0` |
| `+Infinity` | `f64::MAX` (~1.7976931348623157e308) |
| `-Infinity` | `f64::MIN` (~-1.7976931348623157e308) |

### 2.3 Integer Representation

Integers (values with no fractional part) SHOULD be serialized without decimal places when possible.

**Example**:
```json
// Value 100.0 (after normalization)
// Canonical: 100 (not 100.0)
```

### 2.4 Float Noise Elimination

IEEE 754 floating-point arithmetic can produce "noise" (e.g., `0.1 + 0.2 ≠ 0.3` exactly). Normalization eliminates this.

**Example**:
```javascript
// JavaScript
0.1 + 0.2  // = 0.30000000000000004

// After normalization
float_normalize(0.1 + 0.2)  // = 0.3
```

---

## 3. String Normalization

### 3.1 Escape Sequences

Strings MUST be JSON-escaped with the following rules:

| Character | Escape Sequence |
|-----------|-----------------|
| `\` | `\\` |
| `"` | `\"` |
| newline | `\n` |
| carriage return | `\r` |
| tab | `\t` |

### 3.2 Unicode

Unicode characters SHOULD NOT be escaped unless required by the serialization format.

**Example**:
```json
// Preferred
{"text": "héllo"}

// Acceptable but not preferred
{"text": "h\u00e9llo"}
```

---

## 4. Null and Absent Fields

### 4.1 Null Values

`null` values are serialized as `null` (not omitted).

**Example**:
```json
{"value": null}  // Correct
{}               // Incorrect (different meaning)
```

### 4.2 Optional Fields

Optional fields with `None`/`undefined` values:

- **In Input**: MAY be omitted
- **In Output**: MUST be serialized consistently

**Rust Convention**: Use `#[serde(skip_serializing_if = "Option::is_none")]` for optional fields.

**TypeScript Convention**: Omit undefined fields from output objects.

### 4.3 Default Values

Fields with default values SHOULD NOT be serialized if they equal the default.

**Example** (`adversarial` field on `Scenario`):
```json
// If adversarial = false (default)
{"id": "s1", "probability": 0.5}  // Correct (adversarial omitted)

// If adversarial = true
{"id": "s1", "probability": 0.5, "adversarial": true}  // Correct
```

---

## 5. Stable Ordering for Semantic Sets

### 5.1 Actions and Scenarios

Actions and scenarios are semantically sets (identified by unique IDs). For fingerprint computation, they MUST be sorted by ID.

**Rule**: Sort by `id` field lexicographically before hashing.

**Example**:
```json
// Input (any order)
{"actions": [{"id": "buy", ...}, {"id": "sell", ...}]}

// For fingerprint computation, sort by id
{"actions": [{"id": "buy", ...}, {"id": "sell", ...}]}  // Sorted
```

### 5.2 Outcome Tuples

Outcomes are `(action_id, scenario_id, utility)` tuples. For fingerprint computation:

1. Sort by `action_id` first
2. Then by `scenario_id` within each action

**Example**:
```json
// Canonical ordering
{
  "outcomes": [
    ["buy", "bear", -50],
    ["buy", "bull", 100],
    ["hold", "bear", -10],
    ["hold", "bull", 30]
  ]
}
```

---

## 6. Tie-Break Rules

### 6.1 Ranking Tie-Breaks

When actions have identical composite scores, tie-break using **lexicographic order by `action_id`**.

**Rule**: `a.id < b.id` ranks higher (appears first).

**Example**:
```json
// Both actions have composite_score = 50
// Tie-break: "alpha" < "beta"
{"ranked_actions": [
  {"action_id": "alpha", "composite_score": 50, "rank": 1},
  {"action_id": "beta", "composite_score": 50, "rank": 2}
]}
```

### 6.2 Flip Distance Ordering

Flip distances are sorted by `flip_distance` ascending (smallest = most sensitive first).

**Tie-break**: If flip distances are equal, sort by `variable_id` lexicographically.

---

## 7. Fingerprint Computation

### 7.1 Algorithm

```
fingerprint = SHA-256(canonical_json_bytes)
```

The fingerprint is a 64-character lowercase hex string.

### 7.2 What is Fingerprinted

For `DecisionInput`, the fingerprint is computed from the **canonical JSON representation** of the input, including:

- `id` (if present)
- `actions` (sorted by id)
- `scenarios` (sorted by id)
- `outcomes` (sorted by action_id, then scenario_id)
- `constraints` (if present)
- `evidence` (if present)

**NOT included in fingerprint**:
- `meta` field (explicitly excluded from scoring)

### 7.3 Output Fingerprint

The `DecisionOutput.determinism_fingerprint` is the fingerprint of the **input**, not the output. This allows verification that the same input produces the same output.

---

## 8. Error Handling

### 8.1 Error Codes

All errors MUST return structured JSON with:

| Code | Meaning |
|------|---------|
| `E_SCHEMA` | Invalid JSON schema |
| `E_INVALID_INPUT` | Invalid input values (e.g., negative probability) |
| `E_NOT_FOUND` | Referenced entity not found |
| `E_INTERNAL` | Internal error (should not happen) |

### 8.2 Error Format

```json
{
  "ok": false,
  "error": {
    "code": "E_INVALID_INPUT",
    "message": "Probability must be between 0 and 1",
    "details": {
      "field": "probability",
      "value": -0.5
    }
  }
}
```

### 8.3 Deterministic Errors

Errors MUST be deterministic. The same invalid input MUST produce the same error output.

---

## 9. Implementation Checklist

For any new implementation (TypeScript, Python, etc.), verify:

- [ ] Object keys sorted lexicographically at all levels
- [ ] Floats normalized to 1e-9 precision
- [ ] NaN → 0.0, ±Infinity → f64::MAX/MIN
- [ ] Arrays NOT reordered
- [ ] Actions/scenarios sorted by id for fingerprint
- [ ] Outcomes sorted by (action_id, scenario_id)
- [ ] Tie-breaks use lexicographic action_id
- [ ] SHA-256 fingerprint of canonical JSON
- [ ] Errors are structured and deterministic

---

## 10. Test Vectors

### 10.1 Simple Input

```json
{
  "id": "test_001",
  "actions": [
    {"id": "a", "label": "Action A"},
    {"id": "b", "label": "Action B"}
  ],
  "scenarios": [
    {"id": "s1", "probability": 0.6, "adversarial": false},
    {"id": "s2", "probability": 0.4, "adversarial": true}
  ],
  "outcomes": [
    ["a", "s1", 100],
    ["a", "s2", 50],
    ["b", "s1", 90],
    ["b", "s2", 60]
  ]
}
```

**Expected Fingerprint**: Computed from canonical form with sorted keys and normalized floats.

### 10.2 Float Noise Input

```json
{
  "actions": [{"id": "x", "label": "X"}],
  "scenarios": [{"id": "s", "probability": 1.0}],
  "outcomes": [["x", "s", 0.30000000000000004]]
}
```

**Expected**: `0.30000000000000004` normalizes to `0.3`, producing the same fingerprint as:
```json
{
  "actions": [{"id": "x", "label": "X"}],
  "scenarios": [{"id": "s", "probability": 1.0}],
  "outcomes": [["x", "s", 0.3]]
}
```

---

## Related Documents

- [`docs/DETERMINISM_SPEC.md`](DETERMINISM_SPEC.md) - General determinism requirements
- [`crates/decision-engine/src/determinism.rs`](../crates/decision-engine/src/determinism.rs) - Reference implementation
- [`crates/decision-engine/README.md`](../crates/decision-engine/README.md) - Usage documentation
