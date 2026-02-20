# {{PACK_NAME}} A governed execution pack with replay verification tests for the Reach protocol.

## Structure ```
.
├── pack.json          # Pack manifest
├── policy.rego        # Policy contract
├── fixtures/          # Test fixtures
│   └── sample.txt
├── tests/             # Test suite
│   ├── conformance_test.sh
│   └── replay_test.sh
└── README.md          # This file
```

## Replay Testing This pack includes replay verification to ensure deterministic execution:

1. **Fixture-based testing**: Uses `fixtures/sample.txt` as deterministic input
2. **Hash verification**: Step 3 computes a hash of the fixture content
3. **Replay stability**: Multiple runs produce identical event logs and hashes

## Usage ```bash
# Run all tests reach pack test .

# Run replay-specific tests reach pack test . --fixture replay-verification

# Full health check reach pack doctor .
```

## Determinism Guarantees - Same fixture content → Same hash
- Same execution path → Same event log
- Same event log → Same run fingerprint

## License MIT
