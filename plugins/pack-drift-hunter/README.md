# Drift Hunter Pack Plugin

Detects configuration drift and unexpected changes between runs.

## Part of Pack

This plugin is part of the `drift-hunter` pack:
- **Pack**: `packs/drift-hunter/`
- **Recipes**: `drift-scan`, `diff-runs`
- **Rules**: `no-undeclared-changes`, `version-lock`

## Analyzers

### drift-scan

Scans for configuration drift between runs.

```javascript
// Input
{
  previous: { fingerprint: "abc123...", config: {...} },
  current: { fingerprint: "def456...", config: {...} },
  trackedFiles: [...],
  workspace: "/path/to/workspace"
}

// Output
[
  {
    type: "warning",
    message: "Fingerprint changed: abc123... → def456...",
    severity: "medium",
    rule: "fingerprint-changed"
  }
]
```

### diff-runs

Shows detailed diff between two runs.

```javascript
// Input
{ runA: {...}, runB: {...} }

// Output
[
  {
    type: "warning",
    message: "Found 3 field differences",
    details: {
      fieldDiffs: [...],
      outputDiffs: [...]
    }
  }
]
```

## Evidence Extractor

Collects workspace state and environment markers for drift detection.

## Determinism

All operations are deterministic:
- Object keys sorted before comparison
- Arrays sorted before processing
- Consistent severity ranking
