# Recipe System

The Recipe system is the main onramp for using Reach. Recipes are simple, deterministic pipelines that make governance easy.

## Quick Start

```bash
# List all available recipes
reachctl recipe list

# Run the "wow" demo
reachctl recipe run wow

# Get details about a recipe
reachctl recipe explain wow
```

## Built-in Recipes

### wow
A quick demonstration of Reach capabilities. Perfect for first-time users.

```bash
reachctl recipe run wow
```

### drift-scan (in drift-hunter pack)
Scan your workspace for configuration drift.

### security-scan (in security-basics pack)  
Run essential security checks.

## Creating Custom Recipes

Recipes are defined in JSON format:

```json
{
  "name": "my-recipe",
  "description": "What this recipe does",
  "version": "1.0",
  "steps": [
    {
      "name": "step-name",
      "action": "verify"
    }
  ],
  "deterministic": {
    "enabled": true,
    "frozen_artifacts": true,
    "stable_output": true
  }
}
```

## Starter Packs

- **replay-first-ci**: Deterministic CI with replay verification
- **drift-hunter**: Configuration drift detection
- **security-basics**: Essential security checks

## See Also

- [PACKS.md](PACKS.md) - More about packs
- [docs/CONFIG.md](../CONFIG.md) - Configuration options
