# Reach Plugins

This directory contains official plugins, community plugins, and the plugin template.

## Quick Start

```bash
# Scaffold a new plugin
./reach plugins scaffold my-plugin

# Validate a plugin
./reach plugins validate plugins/my-plugin

# List all plugins
./reach plugins list
```

## Structure

```
plugins/
├── README.md              # This file
├── registry.json          # Local plugin registry
├── template/              # Plugin scaffolding template
├── cookbook/              # Step-by-step plugin recipes
└── [plugin-name]/         # Individual plugins
```

## Official Plugins

| Plugin | Description | Capabilities |
|--------|-------------|--------------|
| `evidence-enricher` | Adds metadata to evidence items | `registerEvidenceExtractor` |
| `export-postprocessor` | Transforms export bundles | `registerRenderer` |
| `junction-rule-pack` | Reusable junction rules | `registerPolicy` |

## Sample Plugins

| Plugin | Description | Use Case |
|--------|-------------|----------|
| `sample-deterministic-plugin` | Minimal deterministic example | Learning |
| `sample-export-hook` | Export bundle augmentation | Reference |
| `sample-junction-rule` | Junction rule implementation | Reference |
| `sample-summarizer` | Evidence summarization | Reference |

## Plugin Packs

| Pack | Description |
|------|-------------|
| `pack-drift-hunter` | Detect policy drift |
| `pack-replay-first-ci` | CI-focused replay validation |
| `pack-security-basics` | Security policy enforcement |

## Capabilities Reference

Plugins can register these capabilities:

- `registerAnalyzePrAnalyzer` - Analyze PRs/decisions
- `registerDecisionType` - Add custom decision types
- `registerPolicy` - Register custom policies
- `registerEvidenceExtractor` - Extract evidence from sources
- `registerRenderer` - Format output
- `registerRetriever` - Fetch external data

See [cookbook/](cookbook/) for detailed implementation guides.

## Determinism Requirements

Plugins used in replay must be deterministic:

- Same input → same output
- No `Math.random()` without seed
- No `Date.now()` in output paths
- Sort map keys before iteration

## Registry Format

The `registry.json` file tracks plugin metadata:

```json
{
  "version": "1.0.0",
  "plugins": [
    {
      "id": "my-plugin",
      "name": "My Plugin",
      "version": "1.0.0",
      "path": "plugins/my-plugin",
      "capabilities": ["registerRenderer"],
      "deterministic": true
    }
  ]
}
```
