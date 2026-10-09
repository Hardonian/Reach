# Replay Verification Example This example demonstrates deterministic replay verification with fixture-based testing.

## What This Pack Demonstrates - **Fixture-based testing**: Uses deterministic fixtures as inputs

- **Hash verification**: Computes hash of fixture content
- **Replay stability**: Multiple runs produce identical results
- **Dependency chains**: Steps depend on previous step outputs

## Execution Flow 1. **step-1**: Echo start message

2. **step-2**: Read `fixtures/deterministic.txt`
3. **step-3**: Hash the content from step-2

## Determinism Guarantees - The fixture content never changes

- The hash of the fixture is deterministic
- The event log sequence is identical across runs
- The run fingerprint is stable

## Running ```bash

cd examples/packs/replay-verification

# Lint the pack reach pack lint .

# Run conformance tests reach pack test .

# Full health check reach pack doctor .

```

## Verification The conformance harness will:
1. Run the pack multiple times
2. Verify the run hash is identical each time
3. Verify replay produces the same hash
4. Report any determinism failures
```
