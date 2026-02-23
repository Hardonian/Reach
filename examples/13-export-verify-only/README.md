# Example 13: Export + Verify Only

**Level:** Intermediate | **Time:** 2 min

Demonstrates the export and verify workflow without replay - perfect for archival and attestation.

## What This Demonstrates

- Exporting a run to a portable capsule
- Verifying capsule integrity (cryptographic proof)
- Understanding attestation without execution

## Prerequisites

- Reach CLI installed
- An existing run to export

## Running

```bash
# Using the example runner
node examples/13-export-verify-only/run.js

# Or manually
reach capsule create <run-id> --output my-run.capsule.json
reach capsule verify my-run.capsule.json
```

## Expected Output

```
=== Reach Example 13: Export + Verify Only ===

Step 1: Creating capsule from run...
✅ Capsule exported: my-run.capsule.json
   - Run ID: run-xxx
   - Fingerprint: sha256:abc...
   - Events: 5
   - Size: 2.4 KB

Step 2: Verifying capsule...
✅ Manifest signature valid
✅ Event log hash matches fingerprint
✅ Policy decision: allow
✅ No tampering detected

Verification complete! Capsule is authentic.
```

## Exit Codes

- `0` - Verification passed
- `5` - Verification failed (tampering detected)
- `1` - Export/verify error

## Attestation Use Case

This workflow is ideal for:

- **Compliance**: Prove execution occurred as recorded
- **Archival**: Store verifiable execution records
- **Sharing**: Transfer execution proof without data
- **Audit**: Third-party verification without replay

## Files

- `run.js` - Example runner
- `README.md` - This documentation
