# {{PACK_NAME}}

A federation-aware execution pack for the Reach protocol.

## Federation Support

This pack includes metadata for federation delegation:

- **delegation_allowed**: Whether the pack can be delegated to other nodes
- **max_hops**: Maximum delegation depth (default: 3)
- **trust_threshold**: Minimum trust score for delegate nodes (0.0-1.0)

## Structure

```
.
├── pack.json          # Pack manifest with federation metadata
├── policy.rego        # Policy contract
├── README.md          # This file
└── tests/
    └── conformance_test.sh
```

## Usage

```bash
# Check federation configuration
reach pack lint .

# Run conformance tests
reach pack test .

# Full health check
reach pack doctor .
```

## Federation Behavior

When this pack is executed in a federated environment:

1. The coordinator checks `federation.delegation_allowed`
2. If true, the pack may be delegated based on trust scores
3. Execution respects `max_hops` to prevent infinite delegation
4. Results are aggregated according to federation protocol

## License

MIT
