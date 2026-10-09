# OSS Build Guarantee

**Enforced by**: `scripts/validate-oss-purity.ts`

Reach guarantees that the Open Source edition can be built and run without:

1. Proprietary dependencies.
2. Cloud provider SDKs (AWS, GCP, Azure).
3. SaaS vendor SDKs (Stripe, Auth0).

## The "Zero-Cloud" Lock

The `validate:oss-purity` CI check scans the entire `services/runner` codebase (excluding explicit cloud adapters) to ensure no toxic imports exist.

### Toxic Imports List

- `github.com/aws/aws-sdk-go`
- `cloud.google.com/go`
- `github.com/Azure/azure-sdk-for-go`
- `github.com/stripe/stripe-go`
- `github.com/auth0/go-auth0`

Any PR introducing these imports into Core paths will be blocked by CI.
To add cloud functionality, implement a `CloudAdapter` in `services/runner/internal/adapters/cloud`.
