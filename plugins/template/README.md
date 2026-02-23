# Plugin Template

This is a minimal scaffold for creating a new Reach plugin.

## Files

- `plugin.json` - Plugin manifest (required)
- `index.js` - Plugin entry point (required)
- `README.md` - Documentation (recommended)

## Quick Start

1. Copy this directory:

   ```bash
   cp -r plugins/template plugins/my-plugin
   cd plugins/my-plugin
   ```

2. Edit `plugin.json`:
   - Change `id` to your plugin name
   - Update `description`
   - Select appropriate `capabilities`

3. Implement your logic in `index.js`

4. Validate:

   ```bash
   reach plugins doctor
   ```

5. Test:
   ```bash
   reach plugins list
   ```

## Manifest Reference

See `../plugin-schema.json` for full schema.

## Capabilities

| Capability                  | Description                   |
| --------------------------- | ----------------------------- |
| `registerAnalyzePrAnalyzer` | Analyze PRs/decisions         |
| `registerDecisionType`      | Add custom decision types     |
| `registerPolicy`            | Register custom policies      |
| `registerEvidenceExtractor` | Extract evidence from sources |
| `registerRenderer`          | Format output                 |
| `registerRetriever`         | Fetch external data           |

## Determinism

Plugins used in replay must be deterministic:

- Same input → same output
- No `Math.random()` without seed
- No `Date.now()` in output paths
- Sort map keys before iteration
