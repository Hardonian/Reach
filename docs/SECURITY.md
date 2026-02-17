# Reach Security Model (Hardening Snapshot)

## Trust model

- Package integrity requires SHA-256 match between index, bundle, and manifest.
- Manifest authenticity requires signature verification against trusted keys.
- Unsigned artifacts are blocked by default and only permitted in explicit dev mode (`DEV_ALLOW_UNSIGNED=1`).
- Remote registries are HTTPS-only by default; plain HTTP requires explicit dev override (`DEV_ALLOW_INSECURE_REGISTRY=1`).

## Consent and capability safety

Marketplace install/update requires all of:

- install intent idempotency key
- explicit accepted capabilities
- explicit risk acknowledgement

If consent does not match required capabilities/risk, installation is denied.

## Drift prevention

- Installed package versions are pinned in lock data and do not silently upgrade.
- CI gates run regression tests for trust, consent, and queue/backpressure behavior.
- `reach doctor` enforces architecture boundaries and trust path continuity.
