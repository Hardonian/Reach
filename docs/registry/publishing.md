# Publishing and Sharing Packs (OSS)

Reach OSS does not require a hosted registry.

## Recommended publication flow

1. Build and validate your pack locally.
2. Publish source via git or archive.
3. Consumers install with `reach pack add <source>`.
4. Consumers commit `pack.lock.json` for reproducible installs.

## Compatibility contract

Declare in `pack.json`:

```json
{
  "compatibility": {
    "reach_version_range": ">=0.3.0,<=0.4.0",
    "schema_version_range": ">=1.0.0,<=1.0.0",
    "required_capabilities": ["filesystem:read"],
    "deterministic_constraints": ["forbid_nondeterministic_apis"]
  }
}
```

Install and run operations enforce these ranges and fail with suggested upgrade/downgrade guidance.
