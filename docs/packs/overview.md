# Packs Overview

Reach packs bundle deterministic tasks, policy controls, and replayable evidence.

## Starter packs
- `packs/audit-evidence-capture`
- `packs/webhook-transcript-verify`
- `packs/file-integrity-run`
- `packs/dry-run-simulation`

## Quick start
```bash
reach pack init --template starter-policy-task my-pack
cd my-pack
reach pack validate .
reach run .
```

## Recommended next commands
```bash
reach pack lint .
reach pack test .
reach export <run-id>
reach replay <run-id>
```
