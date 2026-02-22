# Deterministic Stress Testing Model

Reach uses a stress harness to verify that the execution engine remains deterministic even when subjected to potential sources of entropy.

## Entropy Sources

The stress harness simulates three primary types of nondeterminism:

1. **Map Iteration Drift**: In many languages (including Go), map iteration order is randomized. We verify that our hashing always canonicalizes maps before processing.
2. **Array Order Perturbation**: We test that if input arrays are reordered, we detect it, OR if our logic is intended to be order-agnostic, that we normalize arrays appropriately.
3. **Unstable Timestamps**: In-process timestamps or environmental time drift. We verify that sensitive metadata is normalized to a epoch-zero value before final hashing.

## Test Strategy

Stress tests are located in `services/runner/internal/determinism/stress_test.go`.

### Execution trials

We run the same execution pipeline `N` times (default N=5) and verify bit-identical output hashes.

### Mutation Stress

We intentionally mutate internal state ordering between steps to ensure the hash remains stable at the boundary.

## Performance Requirements

Deterministic hashing must not introduce more than 5% overhead to the total execution time. Benching is conducted via `reach benchmark`.
