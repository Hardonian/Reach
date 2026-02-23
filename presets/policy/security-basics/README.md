# Security Basics Preset

Essential security policies for production deployments.

## What's Included

- Minimum evidence requirements
- High-risk evidence blocking
- Signature verification
- Evidence freshness checks

## Usage

```bash
# Preview
./reach presets apply security-basics --dry-run

# Apply
./reach presets apply security-basics --yes
```

## Policies

| Policy             | Description                                   |
| ------------------ | --------------------------------------------- |
| min-evidence       | Requires at least 2 evidence items            |
| block-high-risk    | Blocks if high/critical risk evidence present |
| require-signatures | All evidence must be signed                   |
| check-expiration   | Evidence must be less than 7 days old         |

## Configuration

After applying, customize in `.reach/config.json`:

```json
{
  "policies": {
    "min-evidence": { "min": 3 },
    "check-expiration": { "maxAgeMs": 86400000 }
  }
}
```
