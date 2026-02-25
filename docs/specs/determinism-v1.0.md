# Reach Determinism Specification (v1.0)

## Status: Normative

---

## 1. Introduction

This specification defines the requirements for deterministic fingerprinting of preimages (policy inputs, governance intents, and execution state) within the Reach platform. Determinism is the foundation of the Reach "Decision Infrastructure," ensuring that a given input consistently produces the same cryptographic identifier across different implementations (TypeScript, Rust, Go) and environments.

### 1.1 Goal

The goal of this specification is to eliminate "Execution Drift"—where the same governance intent results in different outcomes due to implementation-specific variances in data handling.

### 1.2 Non-Goals

- Human-readable serialization (canonicalization is for hashing, not for display).
- Performance optimization at the expense of bit-parity.
- Support for non-JSON-compatible data types (e.g., Circular references, Classes, Functions).

---

## 2. Canonicalization

Canonicalization is the process of converting a data structure into a stable, byte-exact representation.

### 2.1 Object Key Ordering

- Implementations **MUST** sort object keys lexicographical in ascending order.
- Sorting **MUST** be based on UTF-8 byte values.
- Sorting **MUST** be performed recursively for all nested objects.

### 2.2 Array Preservation

- Implementations **MUST** preserve the original order of elements within arrays.
- Implementations **MUST NOT** sort array elements unless explicitly defined by a specific sub-schema.

### 2.3 Data Types

| Type | Requirement |
| :--- | :--- |
| **Strings** | **MUST** be UTF-8 encoded. Normalization (e.g., NFC) **SHOULD** be applied if inputs originate from diverse sources. |
| **Integers** | **MUST** be represented as their literal numeric value. Implementations **MUST NOT** use scientific notation for integer values. |
| **Booleans** | **MUST** use literal `true` or `false`. |
| **Null** | **MUST** use literal `null`. |
| **Floats** | **SHOULD** be avoided in high-integrity preimages. If utilized, implementations **MUST** normalize to 9 decimal places (1e-9) to prevent cross-language drift. |

---

## 3. Hashing

### 3.1 Algorithm

- The primary hashing algorithm is **SHA-256**.
- Implementations **MUST NOT** use MD5, SHA-1, or other deprecated algorithms for determinism fingerprints.

### 3.2 Output Encoding

- The fingerprint **MUST** be represented as a 64-character hexadecimal string.
- Hexadecimal characters **MUST** be lowercase.

---

## 4. Verification and Compliance

### 4.1 Golden Vectors

The `determinism.vectors.json` file serves as the normative test suite. An implementation is considered compliant **ONLY IF** it passes all non-float vectors.

### 4.2 Drift Detection

Any system observing a change in fingerprint for the same preimage **MUST** trigger a `DETERMINISM_DRIFT` exception and halt execution until the collision or implementation variance is resolved.

---

## 5. Security Considerations

### 5.1 Preimage Disclosure

Fingerprints are one-way hashes. However, because governance intents often contain structured data, rainbow table attacks may be possible if the entropy of specific fields (e.g., UUIDs) is low. Reach implements salting for Enterprise-tier sensitive preimages.

### 5.2 Implementation Hardening

Implementations **MUST** guard against hash flooding attacks by enforcing depth limits on recursive canonicalization (default depth: 25).

---

## 6. Versioning

This is version 1.0 of the Reach Determinism Specification. Future revisions **MUST** increment the version number and maintain a backward compatibility mapping for existing fingerprints.
