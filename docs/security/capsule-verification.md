# Capsule Verification

Capsules can be signed and verified independently of replay.

## Commands
- `reach capsule sign <capsule-file>`
- `reach capsule verify-signature <capsule-file>`

## Verification checks
- pack lock hash
- transcript hash
- schema version
- hash version (`sha256-v1`)
- Ed25519 signature validity

Determinism replay (`reach capsule replay`) remains independent.
