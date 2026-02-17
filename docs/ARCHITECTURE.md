# Reach Architecture Boundaries

## Non-negotiable boundaries

- **Runner** (`services/runner`) owns runtime execution, queueing, and capability firewalls.
- **Policy** (`services/policy-engine`, policy profile paths in integration hub) owns allow/deny decisions.
- **Packkit** (`internal/packkit`, `tools/packkit*`) owns package/index/signature primitives.
- **Marketplace** (`services/connector-registry/internal/api`, `.../internal/registry/marketplace.go`) owns discovery + consent UX flows only.

## Import constraints enforced in CI/doctor

- Marketplace API cannot import runner internals.
- Runner public API cannot import secret-bearing webhook modules.
- Packkit CLI cannot bypass trust rules by importing config paths that weaken verification.
- Connector installation path must keep manifest signature verification wired.

These checks run through `reach doctor` and the `hardening regression gates` CI job.

## Core trust invariants

- Signature and SHA verification are mandatory unless explicit dev flags are set.
- Install/update operations require intent key + explicit consent fields.
- Pinned installed versions do not silently auto-upgrade.
- Registry fetches use bounded payload sizes, retries, and HTTP timeouts.
- Marketplace catalog caching is bounded by TTL and max-items cap.
