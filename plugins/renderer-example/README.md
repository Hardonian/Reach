# Renderer Example Plugin

Custom output formatters for different presentation needs.

## Renderers

### json-compact

Minified JSON for machine parsing:

```bash
reach run my-pack --format json-compact
```

### json-pretty

Formatted JSON with indentation:

```bash
reach run my-pack --format json-pretty
```

### markdown

Human-readable Markdown with tables:

```bash
reach run my-pack --format markdown
```

Output:

````markdown
# Reach Execution Result

## Summary

| Property    | Value            |
| ----------- | ---------------- |
| ID          | run_abc123       |
| Status      | success          |
| Fingerprint | sha256:a3f7b2... |

## Outputs

```json
{
  "decision": "approved",
  "confidence": 0.85
}
```
````

````

### html

Full HTML page with styling:

```bash
reach run my-pack --format html --output result.html
````

## Usage

```bash
# Use specific renderer
reach run my-pack --renderer renderer-example --format markdown

# List available formats from this plugin
reach renderer list --plugin renderer-example
```

## Extending

Add new renderers by extending the `renderers` object:

```javascript
{
  "my-format": {
    description: "My custom format",
    contentType: "text/plain",
    render(data) {
      return `Result: ${data.status}`;
    }
  }
}
```
