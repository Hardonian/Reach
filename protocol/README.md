# Protocol Versioning Policy

## Versioning rules

- Schema files are versioned by directory (`protocol/v1/**`).
- Every protocol object must contain a `schemaVersion` field.
- `schemaVersion` is semver and must match the major directory version.

## Breaking changes

- A breaking change requires a major version bump (`v1` -> `v2`).
- Breaking changes include removing fields, changing field types, tightening enums, or changing required properties.
- Non-breaking additive changes stay in the same major version and should keep backward-compatible parsing.

## Deprecation process

1. Mark fields/events as deprecated in documentation and release notes.
2. Keep deprecated fields readable for at least one full minor release cycle.
3. Emit migration guidance in clients and integration docs before removal.
4. Remove only in next major version after the deprecation window is complete.

## Contract fixtures

`protocol/examples/*.json` are golden fixtures used by runner, mobile, and VS Code contract tests.
CI validates both schema shape and fixture compatibility to prevent schema drift.
