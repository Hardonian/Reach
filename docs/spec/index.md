# Reach Public Spec

This document defines public contracts for ecosystem interoperability.

## 1. Agent Operating Contract (AOC)

- Inputs: repository context, policy context, execution constraints.
- Outputs: deterministic actions, auditable artifacts, replay-safe metadata.
- Requirement: no hidden side effects outside declared artifact boundaries.

## 2. Patch Pack Spec (PPACK)

- Canonical structure:
  - `id`
  - `base_ref`
  - `target_ref`
  - `files[]` with deterministic order
- Integrity: each patch pack must be hashable and reproducible from source intent.

## 3. Run Record Spec

- Includes run ID, mode, artifact list, and canonical hashes.
- Run records must be replay-checkable and tenant-scoped.

## 4. Artifact Manifest Spec

- Includes artifact names and SHA256 values.
- Stable ordering required for deterministic verification.

## 5. Provider Adapter SDK Spec

- Provider request/response contracts validated by schema.
- Health and retry semantics are explicit and testable.
- Fallback selection must exclude the active primary provider.

## 6. Policy Engine Spec

- Policy evaluation returns deterministic pass/fail outcomes and reasons.
- Output includes primary reason and related signals for noise control.

## 7. SCCL Sync Protocol Spec

- SCCL artifact endpoints expose replay and content-hash metadata.
- Sync consumers must verify hash alignment before apply.

## Conformance Entry Point

Run all public-contract checks:

```bash
npm run verify:conformance
```
