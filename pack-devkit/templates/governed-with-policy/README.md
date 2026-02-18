# {{PACK_NAME}}

A governed execution pack with policy contract for the Reach protocol.

## Structure

```
.
├── pack.json          # Pack manifest
├── policy.rego        # Policy contract (Rego)
├── README.md          # This file
└── tests/             # Conformance tests
    ├── conformance_test.sh
    └── policy_test.sh
```

## Policy

This pack includes a policy contract (`policy.rego`) that:
- Requires signing for execution
- Denies high-risk permissions for unverified publishers
- Explicitly allows specific tools

## Usage

```bash
# Lint the pack
reach pack lint .

# Run conformance tests
reach pack test .

# Full health check
reach pack doctor .

# Sign the pack (required for governed packs)
reach pack sign . --key <keyfile>
```

## Determinism

This pack is configured for deterministic execution with governance controls.

## License

MIT
