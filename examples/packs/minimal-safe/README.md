# Minimal Safe Pack Example

This is a minimal safe pack demonstrating deterministic execution in Reach.

## What This Pack Demonstrates

- **Minimal tool declarations**: Only uses `echo`
- **No permissions required**: Safe by default
- **Deterministic execution**: Same inputs → same outputs

## Quick Start

### Step 1: Verify the pack

```bash
cd examples/packs/minimal-safe
reach pack lint .
reach pack doctor .
```

### Step 2: Run the pack

```bash
reach run examples.minimal-safe
```

### Step 3: Verify determinism

```bash
reach verify-determinism --n=5 --pack examples.minimal-safe
```

## Pack Structure

```json
{
  "spec_version": "1.0",
  "metadata": {
    "id": "examples.minimal-safe",
    "version": "1.0.0"
  },
  "declared_tools": ["echo"],
  "deterministic": true
}
```

## Key Features

1. **Safe by default**: No filesystem or network access
2. **Deterministic**: `deterministic: true` guarantees reproducibility
3. **Minimal attack surface**: Only declares tools it needs
4. **Version stamped**: Uses spec_version for compatibility guarantees

## Next Steps

- Try the [Policy Denial Example](../policy-denial/README.md) to see policy enforcement
- Try the [Replay Verification Example](../replay-verification/README.md) to verify reproducibility
- Run `reach init --template=governed` to create a governed pack
