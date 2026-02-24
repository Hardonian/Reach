# Capsules Overview

A capsule is a reproducible, portable artifact for verify/replay.

## Capsule content

- pack reference from run manifest
- lock snapshot (`pack.lock.json` entries when available)
- inputs
- expected outputs (`run_fingerprint`, `steps`)
- event transcript
- evidence (`audit_chain`, `audit_root` when present)

## Commands

- `reach capsule create <runId> [--output file]`
- `reach capsule verify <file>`
- `reach capsule replay <file>`

`verify` and `replay` recompute the run fingerprint from transcript and run id using existing deterministic hashing semantics.
