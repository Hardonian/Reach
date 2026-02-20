# Minimal Safe Pack Example This is a minimal safe pack demonstrating deterministic execution in Reach.

## What This Pack Demonstrates - **Minimal tool declarations**: Only uses `echo`
- **No permissions required**: Safe by default
- **Deterministic execution**: Same inputs → same outputs

## Running ```bash
cd examples/packs/minimal-safe
reach pack lint .
reach pack doctor .
```

## Key Features 1. **Safe by default**: No filesystem or network access
2. **Deterministic**: `deterministic: true` guarantees reproducibility
3. **Minimal attack surface**: Only declares tools it needs
