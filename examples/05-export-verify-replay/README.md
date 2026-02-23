# Example 05: Export Verify Replay

**Purpose:** Export bundle zip → verify → replay → show parity summary. Learn capsule portability and replay verification.

**Level:** Advanced  
**Estimated Time:** 5 minutes

## Quick Run

```bash
node examples/05-export-verify-replay/run.js
```

## What This Example Demonstrates

1. **Export** - Create a portable bundle from a run
2. **Verify** - Check bundle integrity and signatures
3. **Replay** - Re-execute from the event log
4. **Parity Check** - Compare original vs replay fingerprints
5. **Attestation** - Cryptographic proof of execution

## The Capsule Concept

A capsule is a signed, portable bundle containing:
- **Manifest** - Run metadata and configuration
- **Event Log** - Ordered execution events
- **Fingerprints** - SHA-256 hashes for verification
- **Signatures** - Optional cryptographic attestation

## Expected Output

```
=== Export Verify Replay ===

Export:
  Source run: run_abc123
  Bundle: capsule_abc123.zip
  Contents: manifest.json, events.log, fingerprint.sha256

Verify:
  Integrity: ✅ VALID
  Signatures: unsigned (optional)
  Events: 42
  Chain hash: matches

Replay:
  Replay run: run_replay_def456
  Events processed: 42/42
  Determinism: ✅ PASS

Parity:
  Original:   fp_a3f5c8e2...
  Replay:     fp_a3f5c8e2...
  Match:      ✅ IDENTICAL

Certificate:
  Replay verified: ✅
  Determinism proof: ✅
```

## Files

| File | Purpose |
|------|---------|
| `source-run.json` | Original run to export |
| `verify-config.json` | Verification settings |
| `expected-parity.json` | Expected parity results |
| `run.js` | Full workflow runner |

## Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Original   │───►│   Export    │───►│   Verify    │───►│   Replay    │
│    Run      │    │   Bundle    │    │  Integrity  │    │  Execution  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                               │
                                                               ▼
┌─────────────┐    ┌─────────────┐                       ┌─────────────┐
│  Parity     │◄───│   Compare   │◄──────────────────────│   Replay    │
│  Certificate│    │ Fingerprints│                       │    Run      │
└─────────────┘    └─────────────┘                       └─────────────┘
```

## What To Try Next

1. Modify a bundle and watch verification fail
2. Export with signing for attestation
3. Try [Example 06: Retention Compact Safety](../06-retention-compact-safety/)
