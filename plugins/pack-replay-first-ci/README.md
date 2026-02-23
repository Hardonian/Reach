# Replay-First CI Pack Plugin

Deterministic CI with replay verification and proof generation.

## Part of Pack

This plugin is part of the `replay-first-ci` pack:
- **Pack**: `packs/replay-first-ci/`
- **Recipes**: `replay-verify`, `ci-check`
- **Rules**: `determinism-required`, `frozen-artifacts`

## Analyzers

### replay-verify

Verifies that a run can be replayed with identical results.

```javascript
// Input
{
  original: { fingerprint: "abc123...", events: [...] },
  replay: { fingerprint: "abc123...", events: [...] }
}

// Output
[
  { type: "success", message: "Fingerprints match...", severity: "low" },
  {
    type: "info",
    message: "Replay verification complete",
    proof: {
      verified: true,
      original_fingerprint: "abc123...",
      replay_fingerprint: "abc123...",
      match: true
    }
  }
]
```

### ci-check

Checks if a configuration is ready for CI.

Checks for:
- `deterministic: true` flag
- `frozen_artifacts` setting
- Required fields (name, version, steps)
- Duplicate step names

## Renderers

### ci-report

Plain text report for CI logs:

```
=== Reach CI Report ===
Run ID: run_abc123
Status: success
Fingerprint: fp_abc123...

## Determinism Check
✓ Proof: VALID
  Original: fp_abc123...
  Replay:   fp_abc123...
  Match:    YES
```

### ci-json

JSON format for programmatic consumption.

## Determinism

All operations are deterministic:
- Sorted object keys
- Sorted arrays
- Consistent severity ranking
- Stable JSON output
