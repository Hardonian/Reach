# Sample Export Hook Plugin

Adds extra metadata files to export bundles deterministically.

## Features

- **Plugin Metadata** - Adds `plugin-metadata.json` with statistics
- **Human-Readable Summary** - Adds `README.txt` for quick overview
- **Deterministic** - Same run → same files every time
- **Cross-References** - Links related runs and junctions

## Files Added to Bundle

| File                   | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `plugin-metadata.json` | Structured metadata, statistics, audit entry |
| `README.txt`           | Human-readable summary                       |

## Safety

This plugin is safe and deterministic:

- ✅ Read-only (only reads run data)
- ✅ No network access
- ✅ No filesystem modifications
- ✅ Deterministic output (sorted keys, stable algorithms)
- ✅ No side effects

## Usage

```javascript
// Plugin is automatically invoked during export
reach export <run-id> --format zip

// Bundle will include:
// - manifest.json (standard)
// - events.jsonl (standard)
// - fingerprint.sha256 (standard)
// - plugin-metadata.json (added by this plugin)
// - README.txt (added by this plugin)
```

## Metadata Format

```json
{
  "export_format_version": "1.0.0",
  "plugin_generated_by": "sample-export-hook",
  "source_run_id": "run_abc123",
  "plugin_fingerprint": "plugin_fp_a1b2c3d4",
  "statistics": {
    "total_events": 42,
    "total_evidence_items": 5,
    "has_fingerprint": true
  },
  "tags": ["deterministic", "exported", "fingerprinted"],
  "cross_references": [...],
  "audit_entry": {...}
}
```

## Determinism

All operations are deterministic:

- Object keys sorted alphabetically
- Arrays sorted before processing
- No timestamps in output (except audit)
- Stable stringification
