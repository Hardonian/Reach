# Cloud Adapter Model

**Status**: Draft
**Phase**: 6 (OSS Pivot Plan)

## Overview

Reach is designed as an OSS-first system. However, enterprise deployments require integration with cloud-specific services (Auth0, Stripe, S3, etc.). To maintain OSS purity while supporting these features, Reach uses an **Adapter Pattern**.

The core runtime (`services/runner`) defines interfaces for these services but provides default "Local/No-op" implementations. Cloud implementations are injected only when the `REACH_CLOUD` build tag or environment variable is active, typically via a separate `services/cloud` module that is not part of the OSS distribution.

## Adapter Interfaces

### 1. StorageDriver

Abstracts blob and metadata storage.

```go
type StorageDriver interface {
    Write(ctx context.Context, key string, data []byte) error
    Read(ctx context.Context, key string) ([]byte, error)
    List(ctx context.Context, prefix string) ([]string, error)
}
```

- **OSS Implementation**: `SqliteDriver` (stores metadata in SQLite, blobs in `~/.reach/blobs`).
- **Cloud Implementation**: `S3Driver` / `GCSDriver`.

### 2. AuthProvider

Abstracts identity verification.

```go
type AuthProvider interface {
    VerifyToken(token string) (*UserContext, error)
    GetPolicy(userID string) (*Policy, error)
}
```

- **OSS Implementation**: `LocalAuth` (trusts local user, no token required).
- **Cloud Implementation**: `OIDCProvider` (Auth0/Okta).

### 3. BillingProvider

Abstracts usage metering and entitlement checks.

```go
type BillingProvider interface {
    ReportUsage(ctx context.Context, metric string, amount int) error
    CheckEntitlement(ctx context.Context, feature string) (bool, error)
}
```

- **OSS Implementation**: `NoopBilling` (always allows, logs usage to stdout).
- **Cloud Implementation**: `StripeBilling`.

## Injection Mechanism

Adapters are injected at `main.go` startup based on configuration.

```go
// services/runner/cmd/reach-serve/main.go
if config.CloudEnabled {
    server.Use(cloud.NewMiddleware())
} else {
    server.Use(local.NewMiddleware())
}
```

## Constraints

1. **No Cloud Imports in Core**: `services/runner/internal/*` must NEVER import cloud SDKs.
2. **Graceful Degradation**: If a cloud feature is requested in OSS mode (e.g., "Run in Cloud"), it must return `RL-4001 CloudNotEnabledError`.
3. **Interface Stability**: Changes to adapter interfaces require an RFC.
