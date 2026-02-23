# Sample Summarizer Plugin

A safe, read-only plugin that summarizes evidence metadata for quick overview.

## Features

- **Evidence Summary** - Count and categorize evidence items
- **Confidence Analysis** - Calculate average, min, max confidence
- **Quality Checks** - Warn on limited or stale evidence
- **Deterministic** - Same evidence → same summary

## Safety

This plugin is completely safe:

- ✅ Read-only (no mutations)
- ✅ No network access
- ✅ No filesystem access
- ✅ Deterministic output
- ✅ No side effects

## Usage

```javascript
// In your pack configuration
{
  "plugins": ["plugins/sample-summarizer"]
}
```

## Output Example

```json
{
  "summary": "Evidence collection with 5 items",
  "count": 5,
  "categories": [
    { "name": "metrics", "count": 3 },
    { "name": "logs", "count": 2 }
  ],
  "confidence": {
    "average": 0.82,
    "min": 0.65,
    "max": 0.95
  }
}
```
