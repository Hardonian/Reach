# Reach Templates

Starter templates for packs, plugins, and configurations.

## Quick Start

```bash
# Scaffold a new pack
reach scaffold pack my-pack

# Scaffold a new plugin
reach scaffold plugin my-plugin --type analyzer

# Scaffold config
reach scaffold config
```

## Available Templates

### Pack Templates

| Template | Description |
|----------|-------------|
| `minimal` | Bare minimum pack structure |
| `standard` | Pack with policies and tests |
| `governed` | Full governance-ready pack |

### Plugin Templates

| Template | Description |
|----------|-------------|
| `analyzer` | PR/code analyzer plugin |
| `renderer` | Output formatter plugin |
| `retriever` | Data retriever plugin |

## Template Structure

Templates use variable substitution:

```json
{
  "id": "{{name}}",
  "version": "{{version}}",
  "author": "{{author}}"
}
```

Variables are prompted during scaffolding.

## Custom Templates

Add custom templates to `~/.reach/templates/`:

```
~/.reach/templates/
├── pack/
│   └── custom-template/
│       ├── template.json
│       └── files/
└── plugin/
    └── custom-plugin/
        └── ...
```

## Template Manifest

Each template has a `template.json`:

```json
{
  "name": "My Template",
  "description": "What this template creates",
  "variables": [
    { "name": "name", "prompt": "Pack name", "required": true },
    { "name": "version", "default": "1.0.0" }
  ]
}
```
