# Reach Plugins

Extend Reach with custom analyzers, renderers, retrievers, and more.

## What Are Plugins?

Plugins are self-contained modules that add capabilities to Reach:

- **Analyzers** - Process inputs and provide insights
- **Renderers** - Format output for different contexts
- **Retrievers** - Fetch external data sources
- **Decision Types** - Custom decision logic
- **Evidence Extractors** - Pull evidence from various sources

## Quick Start

```bash
# List installed plugins
reach plugins list

# Validate plugin configuration
reach plugins doctor

# Create new analyzer plugin
reach plugins init-analyzer my-analyzer
```

## Plugin Manifest

Every plugin requires a `plugin.json` manifest:

```json
{
  "id": "my-plugin",
  "version": "1.0.0",
  "apiVersion": "1.0.0",
  "deterministic": true,
  "permissions": {
    "network": false
  },
  "capabilities": ["registerAnalyzePrAnalyzer"],
  "entry": "index.js"
}
```

## Available Capabilities

| Capability | Description |
|------------|-------------|
| `registerDecisionType` | Add custom decision types |
| `registerPolicy` | Register custom policies |
| `registerEvidenceExtractor` | Extract evidence from sources |
| `registerRenderer` | Format output |
| `registerRetriever` | Fetch external data |
| `registerAnalyzePrAnalyzer` | Analyze PRs/decisions |

## Plugin Locations

Reach loads plugins from (in order):
1. `./plugins/` - Project-local plugins
2. `~/.reach/plugins/` - User plugins
3. Built-in plugins (this directory)

## Example Plugins

### 1. analyzer-example
A sample PR analyzer that checks for common issues.

### 2. renderer-example
Custom output formatter for JSON and markdown.

### 3. retriever-example
Example data retriever from external APIs.

## Creating a Plugin

### 1. Create Directory

```bash
mkdir plugins/my-plugin
cd plugins/my-plugin
```

### 2. Create Manifest

```json
{
  "id": "my-plugin",
  "version": "1.0.0",
  "apiVersion": "1.0.0",
  "deterministic": true,
  "permissions": { "network": false },
  "capabilities": ["registerAnalyzePrAnalyzer"],
  "entry": "index.js"
}
```

### 3. Implement Plugin

```javascript
// index.js
module.exports = {
  register() {
    return {
      analyzers: [
        {
          id: "my-analyzer",
          category: "quality",
          deterministic: true,
          analyze(input) {
            // Your analysis logic
            return [
              {
                type: "suggestion",
                message: "Consider improving this",
                severity: "info"
              }
            ];
          }
        }
      ]
    };
  }
};
```

### 4. Validate

```bash
reach plugins doctor
```

## Security

- Plugins must declare `deterministic: true` for replay
- Network access requires explicit permission
- All plugins are sandboxed
- Capabilities are explicitly granted

## Best Practices

1. **Keep deterministic** - Same input → same output
2. **Handle errors gracefully** - Don't crash Reach
3. **Document capabilities** - Clear README
4. **Version properly** - Use semantic versioning
5. **Test thoroughly** - Include test cases

## Plugin Schema

See `plugin-schema.json` for the complete plugin manifest schema.
