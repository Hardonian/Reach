# Reach API Versioning Policy ## Overview

The Reach API follows semantic versioning principles to ensure stable and predictable integration experiences.

## Version Identifiers ### API Version (`apiVersion`)

- Represents the implementation version of the API server
- Format: `MAJOR.MINOR.PATCH` (e.g., `1.0.0`)
- Returned by the `GET /version` endpoint

### Spec Version (`specVersion`) - Represents the version of the OpenAPI specification

- Format: `MAJOR.MINOR.PATCH` (e.g., `1.0.0`)
- Indicates the contract that the API implements

## Compatibility Policy ### Backward Compatible Changes

The following changes are considered backward compatible and do not require a major version bump:

- Adding new endpoints
- Adding new optional request parameters
- Adding new fields to response objects
- Adding new enum values
- Changing error messages (while keeping error codes stable)

### Breaking Changes The following changes require a new major version:

- Removing or renaming endpoints
- Removing or renaming request/response fields
- Changing required parameters
- Changing authentication requirements
- Removing enum values
- Changing the meaning of existing fields

## Version Lifecycle | Version Status | Support Level | Description |

|---------------|---------------|-------------|
| Current | Full support | Latest stable version, receives all updates |
| Deprecated | Maintenance only | No new features, security fixes only |
| Sunset | End of life | Scheduled for removal, migrate immediately |

## Endpoint Versioning When breaking changes are introduced, a new API version path is created:

- Current: `/v1/runs`, `/v1/capsules`
- Next major: `/v2/runs`, `/v2/capsules`

Old versions remain available for a deprecation period (minimum 6 months).

## Client Compatibility Clients should:

1. Check `apiVersion` on startup for compatibility
2. Handle unknown fields gracefully (ignore them)
3. Use the `supportedVersions` array to determine compatibility

## Example Version Response ```json

{
"apiVersion": "1.0.0",
"specVersion": "1.0.0",
"compatibilityPolicy": "backward_compatible",
"supportedVersions": ["1.0.0"]
}

```

## Migration Guide When upgrading between major versions:

1. Review the changelog for breaking changes
2. Update client SDK to the matching version
3. Test in a non-production environment
4. Deploy with feature flags for gradual rollout
5. Monitor for errors and roll back if needed
```
