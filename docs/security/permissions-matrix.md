# Permissions Matrix

Default posture is deny-by-default. Access is granted per tenant and role.

## Roles

- `viewer`: read-only.
- `member`: standard operator actions.
- `admin`: governance/policy mutation.
- `owner`: tenant administration.

## Resource Matrix

| Resource / Action                | viewer | member | admin | owner |
| -------------------------------- | ------ | ------ | ----- | ----- |
| Artifact read (`/api/v1/...`)    | ✅     | ✅     | ✅    | ✅    |
| Artifact write/publish           | ❌     | ✅     | ✅    | ✅    |
| Run record read                  | ✅     | ✅     | ✅    | ✅    |
| Gate run trigger                 | ❌     | ✅     | ✅    | ✅    |
| Gate config update               | ❌     | ❌     | ✅    | ✅    |
| Policy bypass / apply governance | ❌     | ❌     | ✅    | ✅    |
| Reconciliation controls          | ❌     | ❌     | ✅    | ✅    |
| Lease/tenant administration      | ❌     | ❌     | ❌    | ✅    |
| Provider adapter management      | ❌     | ❌     | ✅    | ✅    |

## Tenant Boundary Rules

- Every tenant-scoped query must include `tenant_id` or `org_id` filtering.
- Auth context is required before reading tenant resources.
- CI/API keys are scoped and validated before ingest/write operations.
- Cross-tenant access is not allowed by default.
