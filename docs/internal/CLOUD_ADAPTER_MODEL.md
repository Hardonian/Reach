# Cloud Adapter Model

Last Updated: 2026-02-22

## Purpose

This document defines the interface contracts for cloud-enterprise adapters. In OSS mode, all cloud adapters are replaced by local stubs that return `RL-4001 CloudNotEnabledError`. In enterprise mode (`REACH_CLOUD=1`), adapters are implemented with real cloud backends.

The adapter pattern ensures that **OSS Core components never import cloud SDKs** — they only depend on these interface definitions.

---

## Activation

```bash
REACH_CLOUD=0 (or unset)  →  All adapters use OSS stubs
REACH_CLOUD=1             →  Adapters use enterprise implementations
```

Cloud implementations are loaded at runtime via dependency injection, never at compile time in OSS paths.

---

## Adapter Interfaces

### 1. `AuthProvider`

Handles user authentication and authorization.

```go
// OSS stub returns AuthNotEnabled error for all cloud auth operations.
// Enterprise impl: integrates with Auth0/Okta/etc.
type AuthProvider interface {
    // Verify returns the authenticated user or error.
    Verify(ctx context.Context, token string) (*User, error)

    // GetPermissions returns the set of permissions for a user.
    GetPermissions(ctx context.Context, userID string) ([]string, error)

    // IsCloudEnabled returns true only in enterprise mode.
    IsCloudEnabled() bool
}
```

**OSS Stub Behavior:**

```go
func (s *NoopAuthProvider) Verify(ctx context.Context, token string) (*User, error) {
    return nil, &ReachError{Code: "RL-4001", Message: "cloud auth not enabled in OSS mode", Suggestion: "Set REACH_CLOUD=1 to enable enterprise auth."}
}
func (s *NoopAuthProvider) IsCloudEnabled() bool { return false }
```

---

### 2. `BillingProvider`

Handles subscription and usage billing.

```go
// OSS stub returns CloudDisabled error. No billing in local mode.
// Enterprise impl: integrates with Stripe/etc.
type BillingProvider interface {
    // GetSubscription returns the current plan.
    GetSubscription(ctx context.Context, orgID string) (*Subscription, error)

    // RecordUsage records a billable usage event.
    RecordUsage(ctx context.Context, event *UsageEvent) error

    // IsCloudEnabled returns true only in enterprise mode.
    IsCloudEnabled() bool
}
```

**OSS Stub Behavior:**

```go
func (s *NoopBillingProvider) GetSubscription(ctx context.Context, orgID string) (*Subscription, error) {
    return nil, &ReachError{Code: "RL-4001", Message: "billing not enabled in OSS mode"}
}
func (s *NoopBillingProvider) IsCloudEnabled() bool { return false }
```

---

### 3. `ArtifactStore`

Handles cloud storage of run artifacts.

```go
// OSS default: local filesystem (SqliteDriver + FS).
// Enterprise impl: S3/GCS/Azure Blob.
type ArtifactStore interface {
    // Put stores an artifact and returns its content-addressed ID.
    Put(ctx context.Context, artifact *Artifact) (string, error)

    // Get retrieves an artifact by content-addressed ID.
    Get(ctx context.Context, artifactID string) (*Artifact, error)

    // Delete removes an artifact.
    Delete(ctx context.Context, artifactID string) error

    // IsCloudEnabled returns true only in enterprise mode.
    IsCloudEnabled() bool
}
```

**OSS Default Behavior**: Uses `SqliteDriver` + local filesystem. Returns artifacts from `~/.reach/runs/<run_id>/artifacts/`.

---

### 4. `TenantResolver`

Resolves multi-tenant context for cloud deployments.

```go
// OSS stub: single-tenant mode. Returns the local user's context.
// Enterprise impl: resolves org/tenant from JWT claims or API key.
type TenantResolver interface {
    // Resolve returns the tenant context for a request.
    Resolve(ctx context.Context, req *http.Request) (*TenantContext, error)

    // IsCloudEnabled returns true only in enterprise mode.
    IsCloudEnabled() bool
}
```

**OSS Stub Behavior:**

```go
func (s *LocalTenantResolver) Resolve(ctx context.Context, req *http.Request) (*TenantContext, error) {
    return &TenantContext{TenantID: "local", UserID: "local-user", Plan: "oss"}, nil
}
func (s *LocalTenantResolver) IsCloudEnabled() bool { return false }
```

---

## Dependency Injection

Cloud adapters are registered in the server startup:

```go
// OSS mode (default)
auth     := adapters.NewNoopAuthProvider()
billing  := adapters.NewNoopBillingProvider()
store    := adapters.NewLocalArtifactStore(dataDir)
resolver := adapters.NewLocalTenantResolver()

// Enterprise mode (REACH_CLOUD=1)
if os.Getenv("REACH_CLOUD") == "1" {
    auth     = adapters.NewAuth0Provider(cfg.Auth0Config)
    billing  = adapters.NewStripeProvider(cfg.StripeKey)
    store    = adapters.NewS3ArtifactStore(cfg.S3Config)
    resolver = adapters.NewJWTTenantResolver(cfg.JWTSecret)
}

srv := server.New(auth, billing, store, resolver)
```

This pattern ensures the OSS build never compiles cloud SDK code unless `REACH_CLOUD=1` is explicitly set.

---

## OSS Build Guarantee

The `validate:oss-purity` CI check verifies that no cloud SDK is imported by OSS Core paths.

Cloud adapter implementations (the enterprise versions) live in:

- `services/runner/internal/adapters/cloud/` — Go cloud implementations
- These are only compiled when explicitly imported by the enterprise startup path

The OSS startup path (`cmd/reachctl/main.go`) never imports from `adapters/cloud/`.

---

## Error Behavior

When a cloud-only feature is invoked in OSS mode:

```json
{
  "code": "RL-4001",
  "category": "CloudDisabled",
  "message": "This feature requires Reach Cloud (REACH_CLOUD=1).",
  "suggestion": "Set REACH_CLOUD=1 and configure cloud credentials to use this feature.",
  "deterministic": true
}
```

All stubs return `RL-4001`. No requests are made to external services.

---

## Adding a New Adapter

1. Define the interface in `services/runner/internal/adapters/interfaces.go`.
2. Implement the OSS stub in `services/runner/internal/adapters/noop/`.
3. Document the interface here.
4. Add the adapter to the dependency injection in `cmd/`.
5. Enterprise implementations go in `services/runner/internal/adapters/cloud/` and are never imported by OSS paths.

---

## Related Documents

- [`docs/OSS_BUILD_GUARANTEE.md`](OSS_BUILD_GUARANTEE.md) — Zero-cloud purity guarantee
- [`docs/BOUNDARIES.md`](BOUNDARIES.md) — Import rules
- [`docs/IMPORT_RULES.md`](IMPORT_RULES.md) — Enforcement mechanism
- [`docs/ERROR_CODE_REGISTRY.md`](ERROR_CODE_REGISTRY.md) — RL-4xxx cloud error codes
