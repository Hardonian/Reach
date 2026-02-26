# Policy Snapshots

Policy snapshots bind a specific policy source reference to semantic states and transitions.

Snapshot fields:
- `id` (derived from existing hash utility output)
- `sourceRef`
- `effectiveFrom`
- `effectiveTo` (optional)
- `fingerprint`

Policy snapshot binding is additive metadata and does not modify replay or fingerprint semantics.
