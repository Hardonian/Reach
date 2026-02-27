# Fixed-Point Arithmetic Contract

> **Status:** Implemented  
> **Last Updated:** 2026-02-27

## Overview

The Reach determinism system uses fixed-point arithmetic principles to ensure cross-platform, cross-run consistency. This document defines the contract for numeric handling in the digest/hash path.

## Core Principle

**No floating-point conversions in the digest path.**

All hash computations must use integer or string representations. This prevents IEEE 754 floating-point behavior differences across platforms (e.g., x87 vs SSE, different OSes).

## Contract Rules

### 1. Integer Preservation

Integers MUST be serialized as integers in JSON canonical form.

```go
// ✓ CORRECT: Integer preserved
input := map[string]any{"value": 100}
Hash(input) // → consistent across platforms

// ✗ INCORRECT: Float conversion in digest path
// (This would break determinism)
```

### 2. String Representations

When precise decimal values are needed, use string representations:

```go
// ✓ CORRECT: String for precise decimals
input := map[string]any{"price": "19.99"}
Hash(input) // → consistent

// ✓ ACCEPTABLE: Integer for whole numbers  
input := map[string]any{"count": 100}
Hash(input) // → consistent
```

### 3. Float Prohibition in Digest

The determinism package MUST NOT use `float64` in canonical serialization:

```go
// This function is PROHIBITED in digest paths
func prohibitedFloatDigest(data map[string]any) string {
    // Using json.Marshal with float64 values
    // Will produce different results across platforms
}
```

### 4. Display-Only Exception

Float64 MAY be used for non-deterministic display or rendering purposes only:

```go
// ✓ ACCEPTABLE: Float for display only
func FormatForDisplay(value any) string {
    // Display formatting can use float64
    // This is not part of the digest computation
}
```

## Enforcement

### Unit Tests

All fixed-point contracts are enforced by tests in [`services/runner/internal/determinism/selftest_test.go`](services/runner/internal/determinism/selftest_test.go):

```go
func TestFixedPointNoFloatConversions(t *testing.T) {
    // Integer must hash consistently
    input := map[string]any{"value": 100}
    hash1 := Hash(input)
    hash2 := Hash(input)
    
    if hash1 != hash2 {
        t.Error("Integer hashing must be deterministic")
    }
}
```

### Fixture Validation

The [`fixed_point.fixture.json`](services/runner/internal/determinism/fixtures/fixed_point.fixture.json) fixture validates:

1. Integer hashing stability across 200 iterations
2. String vs numeric type differences produce different hashes
3. Nested fixed-point structures maintain determinism
4. Array of integers/floats remain stable

### CI Gate

The CI gate (`verify-determinism`) will fail if:

1. Any iteration produces a different hash than the baseline
2. Float conversions are detected in the digest path
3. Platform-specific numeric behavior is observed

## Tie-Break Rules

When multiple elements have equivalent priority, the following deterministic ordering rules apply:

### Map Key Ordering

- **Rule:** Alphabetical (ASCII) sort
- **Rationale:** Consistent, platform-independent ordering

```go
// Input: {"z": 1, "a": 2, "m": 3}
// Output order: ["a", "m", "z"]
```

### String Numeric Keys

- **Rule:** Lexicographic (string) sort, NOT numeric
- **Rationale:** Avoids platform-dependent numeric parsing

```go
// Input: {"10": 1, "2": 2, "1": 3}
// Output order: ["1", "10", "2"]
```

### Array Order

- **Rule:** Insertion order is PRESERVED, not sorted
- **Rationale:** Array position is semantically significant

```go
// Input: [3, 1, 2]
// Output order: [3, 1, 2] (unchanged)
```

### Dependency Proofs

- **Rule:** Sorted alphabetically by hash
- **Rationale:** Deterministic chaining

```go
// Input: ["dep-c", "dep-a", "dep-b"]
// Output order: ["dep-a", "dep-b", "dep-c"]
```

### Step Sequences

- **Primary:** Sequence number ascending
- **Secondary:** Step ID ascending (lexicographic)

```go
// Input: [{"seq": 2, "id": "b"}, {"seq": 1, "id": "a"}, {"seq": 1, "id": "c"}]
// Output order: ["a", "c", "b"]
```

## References

- [DETERMINISM_SPEC.md](./DETERMINISM_SPEC.md)
- [AGENTS.md](./AGENTS.md) - Section on Entropy Reduction
- [`services/runner/internal/determinism/`](services/runner/internal/determinism/)
