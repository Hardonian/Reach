# Demo Report

**Report ID:** demo-mlzlftw8-t65hlq  
**Generated:** 2026-02-23T19:52:46.292Z  
**Reach Version:** 0.3.1

## Environment

| Property     | Value     |
| ------------ | --------- |
| Node.js      | v25.5.0   |
| Platform     | win32     |
| Architecture | x64       |
| Go           | go1.25.6  |
| Rust         | not found |

## Integrity

**Hash:** `edba97b11d6ebe861b8053f753458ad2`

## Available Examples

- **01-quickstart-local**: ```bash
  node examples/01-quickstart-local/run.js

````
- **02-diff-and-explain**: ```bash
node examples/02-diff-and-explain/run.js
````

- **03-junction-to-decision**: ```bash
  node examples/03-junction-to-decision/run.js

````
- **04-action-plan-execute-safe**: ```bash
node examples/04-action-plan-execute-safe/run.js
````

- **05-export-verify-replay**: ```bash
  node examples/05-export-verify-replay/run.js

````
- **06-retention-compact-safety**: ```bash
node examples/06-retention-compact-safety/run.js
````

## Files

- `manifest.json` - Report metadata and integrity hash
- `timeline.json` - Ordered events and available examples
- `env.json` - Environment snapshot (versions only, no secrets)
- `outputs/` - Key outputs from demo run

## Verification

To verify this report:

```bash
./reach report verify C:\Users\scott\Documents\GitHub\Reach\demo-report
```
