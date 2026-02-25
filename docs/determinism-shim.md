# Determinism Fingerprint Verification Shim

## Overview

This document describes the cross-layer integration shim for determinism fingerprint verification between TypeScript and Rust implementations in the Reach system.

## Current Implementations

### TypeScript
- **Location**: `packages/core/src/nl-compiler/deterministic.ts`
- **Canonicalization**: Recursively sorts object keys lexicographically, preserves array order
- **Hash Algorithm**: SHA-256, hex-encoded output
- **Float Handling**: Uses standard JSON.stringify() which preserves float precision
- **Output Format**: SHA-256 hex string (64 characters)

### Rust
- **Location**: `crates/engine-core/src/decision/determinism.rs`
- **Canonicalization**: Recursively sorts object keys lexicographically using BTreeMap, preserves array order
- **Hash Algorithm**: SHA-256, hex-encoded output
- **Float Handling**: Normalizes to fixed precision (1e-9), formats with minimal decimal places
- **Output Format**: SHA-256 hex string (64 characters)

## Key Differences and Compatibility

The main difference between implementations is float handling. This means that for inputs containing floating-point numbers, the TypeScript and Rust implementations produce different fingerprints. For inputs without floats, the fingerprints will be identical.

## Usage

### Verification Script

To verify the consistency of the TypeScript implementation:

```bash
npm run verify:determinism-bridge
```

This script runs all test vectors through the TypeScript implementation and compares the output against the expected fingerprints.

### Test Vectors

Test vectors are stored in `determinism.vectors.json`. Each vector contains:
- `name`: Descriptive name of the test case
- `input`: The JSON input to be fingerprinted
- `expected_ts_fingerprint`: The expected SHA-256 hex output from the TypeScript implementation
- `expected_rust_fingerprint`: The expected SHA-256 hex output from the Rust implementation (null if not yet determined)
- `notes`: Additional context about the test case

## Adding New Test Cases

1. Open `determinism.vectors.json`
2. Add a new entry with:
   - A descriptive name
   - The input value
   - `expected_ts_fingerprint: null`
   - Optional notes
3. Run `npx tsx temp-test-all-cases.ts` to compute the expected TS fingerprint

## Fallback Mechanism

The shim will implement a fallback mechanism where if the Rust integration is unavailable (e.g., WASM not loaded, native addon missing), the system will automatically fall back to the TypeScript implementation.

## Future Work

1. Implement the actual Rust integration shim (likely using WASM)
2. Compute and update Rust expected fingerprints in the test vectors
3. Enhance the verification script to test both implementations
4. Add the shim to CI pipeline
