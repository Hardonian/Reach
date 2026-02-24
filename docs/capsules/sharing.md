# Capsule Sharing

## Reproducible handoff flow

1. Producer runs pack and creates capsule.
2. Producer shares capsule file through git/artifact store.
3. Consumer verifies capsule integrity.
4. Consumer replays capsule for deterministic confirmation.

## Example

```bash
reach run security-basics --input mode=safe
reach capsule create <run-id> --output ./capsules/security-basics.capsule.json
reach capsule verify ./capsules/security-basics.capsule.json
reach capsule replay ./capsules/security-basics.capsule.json
```
