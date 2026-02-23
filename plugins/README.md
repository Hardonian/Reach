# Reach Plugins

Extend Reach with custom analyzers, renderers, retrievers, and more.

## Quick Start (Copy-Paste)

```bash
# List all installed plugins
reach plugins list

# Validate all plugins
reach plugins doctor

# Create new plugin from template
cp -r plugins/template plugins/my-plugin
```

## Plugin Template

Start with the template:

```bash
cp -r plugins/template plugins/my-plugin
cd plugins/my-plugin
# Edit plugin.json and index.js
```

See `template/README.md` for details.

## Sample Plugins (3 Included)

### 1. Sample Summarizer

**Location:** `plugins/sample-summarizer/`  
**Capability:** Evidence extraction  
**Safety:** ✅ Read-only, no side effects

Summarizes evidence metadata for quick overview.

```javascript
// Usage: Automatically registered as evidence extractor
{
  "plugins": ["plugins/sample-summarizer"]
}
```

**Output:**

```json
{
  "summary": "Evidence collection with 5 items",
  "count": 5,
  "categories": [{ "name": "metrics", "count": 3 }],
  "confidence": { "average": 0.82, "min": 0.65, "max": 0.95 }
}
```

---

### 2. Sample Junction Rule

**Location:** `plugins/sample-junction-rule/`  
**Capability:** Decision types  
**Safety:** ✅ Deterministic, no external state

Adds deployment strategy junction template.

```javascript
// Create a deployment decision
const junction = plugin.createJunction({
  service: "api-gateway",
  risk_tolerance: "low",
  traffic_pattern: "spiky",
});

// Returns ranked options: blue-green, canary, rolling
```

**Options:**
| Strategy | Downtime | Rollback | Best For |
|----------|----------|----------|----------|
| Blue-Green | None | Instant | Critical services |
| Canary | None | Fast | Gradual rollout |
| Rolling | Minimal | Slow | Simple services |

---

### 3. Sample Export Hook

**Location:** `plugins/sample-export-hook/`  
**Capability:** Rendering  
**Safety:** ✅ Deterministic output

Adds metadata files to export bundles.

```bash
# Export includes extra files
reach export <run-id> --format zip

# Bundle contents:
# - manifest.json (standard)
# - plugin-metadata.json (added by plugin)
# - README.txt (added by plugin)
```

**Files Added:**

- `plugin-metadata.json` - Statistics, tags, cross-references
- `README.txt` - Human-readable summary

---

### 4. Sample Deterministic Plugin

**Location:** `plugins/sample-deterministic-plugin/`  
**Capability:** Decision types, analyzers  
**Safety:** ✅ Fully deterministic

Demonstrates deterministic decision making and determinism checking.

```javascript
// Make deterministic choice
plugin.decide({
  seed: "my-seed",
  options: ["a", "b", "c"],
});

// Check code for determinism issues
plugin.analyze({ code: "Math.random()" });
// → Error: Math.random() detected
```

---

## Example Plugins (3 Included)

### Analyzer Example

**Location:** `plugins/analyzer-example/`  
**Capabilities:** Code quality and security analysis

Analyzes code for:

- Function complexity
- TODO/FIXME comments
- console.log usage
- Hardcoded secrets
- eval() usage

---

### Renderer Example

**Location:** `plugins/renderer-example/`  
**Capabilities:** Output formatting

Renderers:

- `json-compact` - Minified JSON
- `json-pretty` - Formatted JSON
- `markdown` - Markdown tables
- `html` - Styled HTML report

---

### Retriever Example

**Location:** `plugins/retriever-example/`  
**Capabilities:** Data fetching

Retrievers:

- `weather` - Mock weather data
- `pricing` - Cloud pricing info
- `exchange-rate` - Currency rates

---

## Pack Plugins (3 Included)

### Pack: Drift Hunter

**Location:** `plugins/pack-drift-hunter/`  
**Pack:** `packs/drift-hunter/`

Detects configuration drift between runs.

**Recipes:**

- `drift-scan` - Scan for configuration changes
- `diff-runs` - Compare two runs

**Usage:**

```bash
reach run pack.json --recipe drift-scan
```

---

### Pack: Replay-First CI

**Location:** `plugins/pack-replay-first-ci/`  
**Pack:** `packs/replay-first-ci/`

Deterministic CI with replay verification.

**Recipes:**

- `replay-verify` - Verify run reproducibility
- `ci-check` - Check CI readiness

**Usage:**

```bash
reach run pack.json --recipe replay-verify
```

---

### Pack: Security Basics

**Location:** `plugins/pack-security-basics/`  
**Pack:** `packs/security-basics/`

Essential security checks.

**Recipes:**

- `security-scan` - Scan for security issues
- `integrity-check` - Verify artifact integrity

**Usage:**

```bash
reach run pack.json --recipe security-scan
```

---

## Creating a Plugin

### 1. Create Directory

```bash
mkdir plugins/my-plugin
cd plugins/my-plugin
```

### 2. Create Manifest (`plugin.json`)

```json
{
  "$schema": "../plugin-schema.json",
  "id": "my-plugin",
  "version": "1.0.0",
  "apiVersion": "1.0.0",
  "name": "My Plugin",
  "description": "What my plugin does",
  "deterministic": true,
  "permissions": {
    "network": false,
    "filesystem": false,
    "env": false
  },
  "capabilities": ["registerAnalyzePrAnalyzer"],
  "entry": "index.js",
  "author": "Your Name",
  "license": "MIT"
}
```

### 3. Implement Entry (`index.js`)

```javascript
module.exports = {
  register() {
    return {
      analyzers: [
        {
          id: "my-analyzer",
          deterministic: true,
          analyze(input) {
            return [
              {
                type: "suggestion",
                message: "Analysis result",
                severity: "info",
              },
            ];
          },
        },
      ],
    };
  },
};
```

### 4. Validate

```bash
reach plugins doctor
```

### 5. Test

```bash
reach plugins list
```

## Capabilities

| Capability                  | Purpose               |
| --------------------------- | --------------------- |
| `registerAnalyzePrAnalyzer` | Analyze PRs/decisions |
| `registerDecisionType`      | Custom decision logic |
| `registerPolicy`            | Custom policies       |
| `registerEvidenceExtractor` | Extract evidence      |
| `registerRenderer`          | Format output         |
| `registerRetriever`         | Fetch external data   |

## Determinism Requirements

Plugins used in replay must be deterministic:

- Same input → same output
- No `Math.random()` without seed
- No `Date.now()` in output paths
- Sort map keys before iteration
- No external state

Mark in manifest:

```json
{
  "deterministic": true
}
```

## Permissions

```json
{
  "permissions": {
    "network": false, // HTTP requests
    "filesystem": false, // File access outside plugin dir
    "env": false // Environment variables
  }
}
```

## Plugin Locations

Reach loads plugins from (in order):

1. `./plugins/` - Project-local plugins
2. `~/.reach/plugins/` - User plugins
3. Built-in plugins

## Validation

Plugins are validated for:

- Manifest schema compliance
- Determinism declaration
- Entry point exists
- Capabilities valid

## Best Practices

1. **Keep deterministic** - Same input → same output
2. **Handle errors gracefully** - Don't crash Reach
3. **Document capabilities** - Clear README
4. **Version properly** - Use semantic versioning
5. **Test thoroughly** - Include test cases

## Schema

See `plugin-schema.json` for complete manifest schema.

## Contributing

To share your plugin:

1. Ensure it passes `reach plugins doctor`
2. Include comprehensive README
3. Add to examples if applicable
4. Submit a PR

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.
