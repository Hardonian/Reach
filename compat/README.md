# Reach Protocol Compatibility Suite This directory contains the compatibility test suite for the Reach Protocol Specification v1.0.0.

## Purpose The compatibility suite validates that implementations conform to the Reach Protocol specification. It ensures:

1. **Determinism**: Same inputs produce same run hashes
2. **Replay**: Executions can be replayed with identical results
3. **Policy**: Capability declarations are enforced
4. **Signature**: Pack integrity is verifiable
5. **Federation**: Delegation chains validate correctly
6. **Schema**: All artifacts validate against JSON schemas

## Running the Suite ```bash
# Run all compatibility tests node compat/compat-suite.mjs

# Or via npm npm run verify:compat
```

## Test Coverage ### Schema Validation
- All JSON schemas are valid Draft 2020-12
- Required fields are properly declared
- Type definitions are consistent

### Determinism Tests - Hash computation is deterministic
- Event ordering is preserved
- Canonical serialization produces consistent results

### Replay Tests - Capsule format includes all required fields
- Tool recordings capture inputs/outputs
- State snapshots are complete

### Policy Tests - Capability declarations are required
- Tool/resource declarations are validated
- Policy violations produce structured errors

### Signature Tests - Ed25519 signatures are required
- SHA-256 digest algorithm is used
- Signature fields are complete

### Federation Tests - Delegation payloads are structured
- Expiration is enforced
- Trust boundaries are maintained

### Error Code Tests - Error codes follow CATEGORY_DETAIL format
- All categories are defined
- Severity levels are specified

## Adding Tests To add a new compatibility test:

1. Add a `test()` call in `compat-suite.mjs`
2. Use descriptive test names
3. Provide clear assertion messages
4. Update this README with the new test category

## Fixtures Test fixtures are stored in `spec/fixtures/`:

- `valid-run.json` - Valid run structure
- `valid-event.json` - Valid event structure
- `valid-pack.json` - Valid pack structure
- `valid-capsule.json` - Valid capsule structure

## Specification Version This compatibility suite validates conformance to:

**Reach Protocol Specification v1.0.0**

See `spec/REACH_PROTOCOL_v1.md` for the normative specification.
