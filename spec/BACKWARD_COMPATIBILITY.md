# Reach Protocol Backward Compatibility Policy

## Versioning Strategy

The Reach Protocol follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** version changes indicate breaking changes
- **MINOR** version changes indicate new features (backward compatible)
- **PATCH** version changes indicate bug fixes (backward compatible)

## Compatibility Guarantees

### Within Major Versions (1.x.x)

All releases within the same major version are **backward compatible**:

- Packs targeting `1.0.0` will work on runtime `1.5.0`
- Runtimes support all spec versions from `MIN_SPEC_VERSION` to `CURRENT_SPEC_VERSION`
- New optional fields may be added in minor versions
- Existing field semantics will not change

### Major Version Changes (X.0.0)

Major version changes indicate **breaking changes**:

- Packs must explicitly migrate to new major version
- Runtime will reject packs with unsupported major versions
- Migration tools will be provided
- Old major versions supported for minimum 12 months

## Deprecation Policy

### Deprecation Timeline

1. **Announcement**: Feature marked deprecated in CHANGELOG
2. **Warning Period**: 2 minor versions with runtime warnings
3. **Removal**: May be removed in next major version

### Current Deprecations

None (initial release).

## Migration Guide

### Upgrading from 1.0.0 to 1.x.x

Minor version upgrades require no action. New features are opt-in.

### Future: Upgrading to 2.0.0

When 2.0.0 is released:

1. Review [MIGRATION-v2.md](./MIGRATION-v2.md) (will be created)
2. Update pack `specVersion` to `2.0.0`
3. Address any breaking changes
4. Validate with compatibility suite

## Runtime Compatibility Checks

The runtime performs explicit spec version checking:

```javascript
import { validatePackSpecVersion } from './spec/version.mjs';

const result = validatePackSpecVersion(pack);
if (!result.valid) {
  // Reject pack with structured error
  throw new SpecVersionError(result.error);
}
```

### Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `PACK_MISSING_SPEC_VERSION` | Pack has no specVersion | Add specVersion field |
| `PACK_SPEC_VERSION_MISMATCH` | Major version mismatch | Migrate to current version |
| `PACK_SPEC_VERSION_TOO_OLD` | Below minimum supported | Upgrade pack |
| `PACK_INVALID_SPEC_VERSION` | Invalid format | Use SemVer format |

## Feature Compatibility Matrix

| Feature | 1.0.0 | Notes |
|---------|-------|-------|
| Execution Model | ✓ | Base execution |
| Policy Enforcement | ✓ | Capability declarations |
| Pack Signing | ✓ | Ed25519 signatures |
| Federation | ✓ | Node delegation |
| Time Capsules | ✓ | Replay support |
| Error Model | ✓ | Structured errors |

## Compatibility Test Suite

Run the compatibility suite to verify conformance:

```bash
npm run verify:compat
```

This validates:
- Schema conformance
- Determinism guarantees
- Replay compatibility
- Policy enforcement
- Error structure

## Support Policy

| Version | Status | Support Until |
|---------|--------|---------------|
| 1.0.0 | Current | N/A (current) |

---

**Last Updated**: 2026-02-18  
**Current Spec Version**: 1.0.0
