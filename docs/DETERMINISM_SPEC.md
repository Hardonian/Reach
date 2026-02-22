# Determinism Specification (Reach V1)

## Overview
Determinism is the foundational invariant of the Reach protocol. The same input execution pack and state must produce the exact same output artifacts and events, bit-for-bit, regardless of the environment.

## Invariants
1. **Instruction Ordering**: All operations must be executed in a stable, predictable sequence. Parallelism must be joined deterministically.
2. **Stable Hashing**: Use SHA-256 for all artifact and state hashing.
3. **Canonical Time**: All timestamps must be normalized to UTC and follow ISO 8601. In strict mode, time is virtualized and starts at `1970-01-01T00:00:00Z`.
4. **Stable IDs**: IDs derived from content (Hashing) rather than randomness (UUID v4).
5. **No Hidden State**: No reliance on uninitialized memory, race conditions, or environment variables not explicitly passed.

## Floating Point & Math
- Avoid floating-point arithmetic in critical paths.
- Use fixed-point math or deterministic software-based FP libraries if required.

## Memory Management
- Iterating over maps/dictionaries must be sorted by key to ensure stable output ordering.

## Verification
Any engine implementation must pass the `conformance-tests` suite which uses golden fixtures from `testdata/fixtures/`.
