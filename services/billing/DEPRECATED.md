# Billing Service - DEPRECATED

> **DEPRECATED: This service is frozen as of OSS pivot.**
>
> See [plans/OSS_REFINEMENT_PLAN.md](../../plans/OSS_REFINEMENT_PLAN.md) for details.

## Status

This billing service module is no longer actively maintained. The code remains in the repository for:

- **Reference**: Understanding historical implementation decisions
- **Backward Compatibility**: Existing deployments that may reference these types
- **Migration Path**: Teams transitioning to the new OSS-first architecture

## What This Means

1. **No New Features**: No new billing features will be added
2. **Bug Fixes Only**: Critical security fixes may be applied, but no active development
3. **Feature Flags**: Features previously gated by billing tiers are now controlled by configuration flags
4. **Single Tenant**: The system now operates with a single default tenant model

## Migration Guide

### Feature Access

Features previously gated by billing tier are now controlled via environment variables:

```bash
REACH_FEATURE_FLAGS=enable_sso,enable_compliance_logs,enable_node_federation
```

### Tenant Model

All operations now use a single default tenant. Use the `DEFAULT_TENANT` constant from `reach/core/config/tenant`:

```go
import "reach/core/config/tenant"

// Use the default tenant constant
tenantID := tenant.DEFAULT_TENANT
```

### Replacing Billing Tier Checks

**Before:**
```go
if billing.Allows(plan, billing.FeatureSSO) {
    // enable SSO
}
```

**After:**
```go
import "reach/core/config/features"

if features.IsEnabled(features.SSO) {
    // enable SSO
}
```

## Timeline

- **Frozen**: 2026-02-18 (OSS Pivot announcement)
- **Removal**: No planned removal - code preserved for reference

## Questions

See the [OSS_REFINEMENT_PLAN.md](../../plans/OSS_REFINEMENT_PLAN.md) for the full context and roadmap.

> **DEPRECATED: This service is frozen as of OSS pivot.**
>
> See [plans/OSS_REFINEMENT_PLAN.md](../../plans/OSS_REFINEMENT_PLAN.md) for details.

## Status

This billing service module is no longer actively maintained. The code remains in the repository for:

- **Reference**: Understanding historical implementation decisions
- **Backward Compatibility**: Existing deployments that may reference these types
- **Migration Path**: Teams transitioning to the new OSS-first architecture

## What This Means

1. **No New Features**: No new billing features will be added
2. **Bug Fixes Only**: Critical security fixes may be applied, but no active development
3. **Feature Flags**: Features previously gated by billing tiers are now controlled by configuration flags
4. **Single Tenant**: The system now operates with a single default tenant model

## Migration Guide

### Feature Access

Features previously gated by billing tier are now controlled via environment variables:

```bash
REACH_FEATURE_FLAGS=enable_sso,enable_compliance_logs,enable_node_federation
```

### Tenant Model

All operations now use a single default tenant. Use the `DEFAULT_TENANT` constant from `reach/core/config/tenant`:

```go
import "reach/core/config/tenant"

// Use the default tenant constant
tenantID := tenant.DEFAULT_TENANT
```

### Replacing Billing Tier Checks

**Before:**
```go
if billing.Allows(plan, billing.FeatureSSO) {
    // enable SSO
}
```

**After:**
```go
import "reach/core/config/features"

if features.IsEnabled(features.SSO) {
    // enable SSO
}
```

## Timeline

- **Frozen**: 2026-02-18 (OSS Pivot announcement)
- **Removal**: No planned removal - code preserved for reference

## Questions

See the [OSS_REFINEMENT_PLAN.md](../../plans/OSS_REFINEMENT_PLAN.md) for the full context and roadmap.

