# Reach Deterministic Fixtures Library

A collection of canonical inputs, bundles, and expected outputs for testing, validation, and demonstration purposes. All fixtures use public schemas with no sensitive data.

---

## Directory Structure

```
fixtures/
├── README.md                 # This file
├── events/                   # Canonical event streams
│   ├── simple-decision.json
│   ├── multi-action.json
│   └── adversarial.json
├── bundles/                  # Pack manifests and configurations
│   ├── minimal-valid.json
│   ├── strict-policy.json
│   └── federation-ready.json
├── reports/                  # Demo report outputs
│   ├── demo-execution.json
│   └── verification-audit.json
└── expected/                 # Expected outputs for regression testing
    ├── decision-output.json
    ├── replay-trace.json
    └── fingerprint.json
```

---

## Usage

### Manual Testing

Use fixtures to quickly test Reach behavior:

```bash
# Run a simple decision
./reach run fixtures/bundles/minimal-valid.json \
  --input fixtures/events/simple-decision.json

# Verify output matches expected
./reach run fixtures/bundles/minimal-valid.json \
  --input fixtures/events/simple-decision.json \
  --output /tmp/actual.json

diff /tmp/actual.json fixtures/expected/decision-output.json
```

### Regression Testing

Compare outputs using canonical JSON:

```bash
# Run determinism check
./reach verify-determinism \
  --pack fixtures/bundles/minimal-valid.json \
  --input fixtures/events/simple-decision.json \
  --expected fixtures/expected/decision-output.json \
  --n 5

# Verify fingerprints match
cat /tmp/run_1.fingerprint
cat /tmp/run_2.fingerprint
# Should be identical
```

### Integration Testing

Use in CI/CD pipelines:

```yaml
# .github/workflows/test-fixtures.yml
- name: Test with canonical fixtures
  run: |
    for fixture in fixtures/events/*.json; do
      ./reach run fixtures/bundles/minimal-valid.json \
        --input "$fixture" \
        --validate
    done
```

---

## Fixture Categories

### Events (`fixtures/events/`)

Small, canonical event streams representing different scenarios:

| File | Description | Complexity |
|------|-------------|------------|
| `simple-decision.json` | Basic 2-action, 2-scenario decision | Beginner |
| `multi-action.json` | 5 actions, 3 scenarios with weights | Intermediate |
| `adversarial.json` | Decision with adversarial flag set | Intermediate |
| `tie-break.json` | Equal utility requiring tie-breaker | Advanced |

### Bundles (`fixtures/bundles/`)

Valid pack manifests for different use cases:

| File | Description | Policies |
|------|-------------|----------|
| `minimal-valid.json` | Smallest valid pack | None |
| `strict-policy.json` | Full policy enforcement | strict-safe-mode |
| `federation-ready.json` | Multi-node federation | strict + mesh |

### Reports (`fixtures/reports/`)

Example report outputs for documentation:

| File | Description | Use Case |
|------|-------------|----------|
| `demo-execution.json` | Typical execution report | Documentation |
| `verification-audit.json` | Full audit trail | Compliance |

### Expected (`fixtures/expected/`)

Canonical outputs for regression testing:

| File | Description | Verified |
|------|-------------|----------|
| `decision-output.json` | Standard decision result | Yes |
| `replay-trace.json` | Execution trace format | Yes |
| `fingerprint.json` | Hash output format | Yes |

---

## Creating New Fixtures

### Guidelines

1. **Deterministic**: Same input must produce same output
2. **Minimal**: Include only necessary fields
3. **Documented**: Add description and purpose
4. **Public**: No secrets, keys, or sensitive data
5. **Versioned**: Include schema version

### Template

```json
{
  "_fixture": {
    "id": "unique-name",
    "description": "What this fixture tests",
    "created": "2026-01-15",
    "schema_version": "1.0.0",
    "complexity": "beginner|intermediate|advanced"
  },
  ... actual fixture data ...
}
```

### Validation

Before adding a fixture:

```bash
# Validate JSON syntax
jq . fixtures/events/my-new-fixture.json

# Validate against schema
./reach validate-fixtures fixtures/events/my-new-fixture.json

# Verify determinism
./reach verify-determinism --n 10 \
  --pack fixtures/bundles/minimal-valid.json \
  --input fixtures/events/my-new-fixture.json
```

---

## Comparing Outputs

### Using `diff`

```bash
# Simple comparison
diff <(jq -S . actual.json) <(jq -S . fixtures/expected/decision-output.json)

# Ignore timestamps
diff <(jq -S 'del(.timestamp)' actual.json) \
     <(jq -S 'del(.timestamp)' fixtures/expected/decision-output.json)
```

### Using `jq`

```bash
# Extract specific fields for comparison
jq '{status, fingerprint, action_count: (.actions | length)}' actual.json
jq '{status, fingerprint, action_count: (.actions | length)}' fixtures/expected/decision-output.json

# Compare fingerprints
jq -r '.fingerprint' actual.json
jq -r '.fingerprint' fixtures/expected/decision-output.json
```

### Using Reach CLI

```bash
# Built-in comparison
./reach diff actual.json fixtures/expected/decision-output.json

# With tolerance for non-deterministic fields
./reach diff --ignore timestamp,random_seed actual.json expected.json
```

---

## Maintenance

### Updating Expected Outputs

When behavior intentionally changes:

```bash
# Regenerate expected outputs
./reach run fixtures/bundles/minimal-valid.json \
  --input fixtures/events/simple-decision.json \
  --output fixtures/expected/decision-output.json

# Commit with explanation
git add fixtures/expected/
git commit -m "fix: update expected outputs for v0.4.0 decision format

Changes:
- Added new 'confidence' field
- Renamed 'action' to 'selected_action'

See CHANGELOG.md for migration guide."
```

### Deprecation

When removing fixtures:

1. Mark as deprecated in `_fixture` block
2. Wait one minor version
3. Remove and update documentation

---

## See Also

- [Decision Fixtures](../fixtures/decision/) - Original decision test fixtures
- [Examples](../../examples/) - Complete working examples
- [Determinism Debugging](../../docs/DETERMINISM_DEBUGGING.md) - Troubleshooting guide
- [Error Codes](../../docs/ERROR_CODES.md) - Reference for fixture validation errors
