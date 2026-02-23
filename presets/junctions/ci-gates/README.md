# CI Gates Junction Rules

Junction rules for common CI/CD gate patterns.

## What's Included

- Build success requirement
- Test pass requirement
- Lint/check pass requirement
- Documentation update check

## Usage

```bash
# Preview
./reach presets apply ci-gates --dry-run

# Apply
./reach presets apply ci-gates --yes
```

## Rules

| Rule | Description |
|------|-------------|
| build-passed | Requires successful build |
| tests-passed | Requires all tests green |
| checks-passed | Requires lint/typecheck pass |
| docs-current | Requires doc updates for code changes |

## Integration

```bash
# In your CI script
./reach junction apply ci-gates --decision $DECISION_ID
```
