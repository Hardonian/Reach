# Replay First CI Preset

Optimized for CI/CD pipelines with deterministic replay as the primary goal.

## What's Included

- Deterministic execution enforcement
- Minimal overhead configuration
- Export bundle generation
- Verification on every run

## Usage

```bash
# Preview
./reach presets apply replay-first-ci --dry-run

# Apply
./reach presets apply replay-first-ci --yes
```

## CI Integration

Add to your CI pipeline:

```yaml
- name: Verify with Reach
  run: |
    ./reach run security-checks
    ./reach verify-proof
```

## Determinism Checks

This preset enables:

- Strict mode for all decisions
- Automatic transcript hashing
- Bundle export on completion
- Verification failure = build failure
