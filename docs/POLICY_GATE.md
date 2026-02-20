# Policy Gate Policy Gate runs before pack-backed execution and evaluates:
- org policy
- remote node identity
- execution pack
- requested tools and permissions
- model requirements

## Decision Returns:
- `allow` or `deny`
- typed deny reasons
- redacted log fields

## Minimum deny rules - Invalid or unsigned pack signature unless legacy unsigned is explicitly allowed.
- Requested tool not declared by the pack.
- Requested permission exceeds declared pack scopes or org policy scopes.
- Pack model requirement not allowed by org policy.
- Optional deterministic enforcement when policy requires deterministic execution.

## Compatibility - `REACH_ALLOW_LEGACY_UNSIGNED_PACKS=false` by default.
- `REACH_POLICY_MODE` supports `warn|enforce`.
- Default mode is `warn` in local development and `enforce` in CI/production.
