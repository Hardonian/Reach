# Deterministic Stress Testing Model

Last Updated: 2026-02-22

## Purpose

The stress harness deliberately injects sources of nondeterminism into test executions to verify that the engine's determinism invariants hold. Stress tests are **test-only** — none of this injection exists in the production code path.

---

## Entropy Sources Tested

### 1. Map Key Iteration Drift

**Mechanism**: Go map iteration order is randomized per-run. Code that iterates a map and feeds the result into an event or hash without sorting may produce different results.

**Test**: Fixture at `testdata/stress/map-iteration-drift.stress.json`

The stress harness passes identical inputs with keys in different orders and asserts the fingerprint is identical.

**Required behavior**: `CanonicalJSON()` must sort all object keys before hashing.

---

### 2. Input Array Order Perturbation

**Mechanism**: Arrays in inputs may arrive in different orders if the caller doesn't sort them consistently.

**Test**: Fixture at `testdata/stress/array-order-perturbation.stress.json`

Two scenarios are tested:

- **Order-sensitive arrays** (e.g., execution steps): reordering MUST produce different fingerprints.
- **Order-agnostic sets** (e.g., capability lists): reordering MUST produce identical fingerprints after normalization.

**Required behavior**: Engine normalizes declared "set" fields by sorting before hashing.

---

### 3. Unstable Timestamp Simulation

**Mechanism**: Wall-clock time injected into execution metadata.

**Test**: Fixture at `testdata/stress/unstable-timestamp.stress.json`

The harness runs the same execution with three different injected wall-clock values (epoch zero, current time, far future) and asserts the fingerprint is identical in all three.

**Required behavior**: `timestamp_epoch` must always be `0` in fingerprint-contributing paths. Wall-clock timestamps appear only in human-readable log metadata.

---

## Stress Harness Architecture

### Test Location (Go)

```text
services/runner/internal/determinism/
├── stress_test.go          # Main stress test runner
├── harness.go              # Fixture loader and assertion helpers
└── fixtures_loader_test.go # Loads testdata/stress/*.stress.json
```

### Test Location (Rust)

```text
crates/engine-core/tests/
├── chaos.rs                # Rust chaos/stress tests
└── property_invariants.rs  # Property-based invariant tests
```

---

## Running the Stress Harness

### Go Stress Tests

```bash
cd services/runner && go test ./internal/determinism/... -v -run TestStress
```

### Rust Chaos Tests

```bash
cargo test -p engine-core -- chaos --nocapture
```

### N=5 Determinism Verification (End-to-End)

```bash
# Runs the same pack 5 times and asserts all fingerprints match
reachctl verify-determinism --n=5
```

### Full Stress Suite (in CI)

The stress suite is run as part of `verify:oss:full`:

```bash
npm run verify:oss:full
```

---

## Performance Requirements

Deterministic hashing overhead must not exceed 5% of total execution time. This is benchmarked via:

```bash
reachctl benchmark --pack demo-pack --trials 10
```

Target: `avg_duration_ms` with determinism enabled ≤ 105% of baseline without.

---

## Adding New Stress Tests

1. Create a fixture in `testdata/stress/<scenario-name>.stress.json`.
2. Add the fixture to the test loader in `services/runner/internal/determinism/fixtures_loader_test.go`.
3. Document the entropy source in this file.
4. Verify the test fails if the corresponding invariant is removed.

---

## Related Documents

- [`docs/DETERMINISM_SPEC.md`](DETERMINISM_SPEC.md) — Invariant rules
- [`docs/DETERMINISM_DEBUGGING.md`](DETERMINISM_DEBUGGING.md) — Debugging divergences
- [`docs/REPLAY_INTEGRITY_PROOF.md`](REPLAY_INTEGRITY_PROOF.md) — Formal proof
- [`testdata/stress/`](../testdata/stress/) — Fixture files
