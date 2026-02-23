# Export Postprocessor Plugin

Transforms export bundles with additional processing options.

## Capabilities

- `registerRenderer` - Post-processes export bundles

## Formats

| Format        | Description                                 |
| ------------- | ------------------------------------------- |
| `standard`    | Default processing, adds metadata           |
| `minimal`     | Only essential fields (id, hash, timestamp) |
| `verbose`     | All fields, sorted, with metadata           |
| `hashes-only` | Only hash-related fields                    |

## Usage

```javascript
// Postprocess with format option
const processed = postprocessBundle(bundle, {
  format: "minimal",
});
```

## Determinism

- Sorts all object keys recursively
- No external dependencies
- Pure function transformation
- Consistent output for same input
