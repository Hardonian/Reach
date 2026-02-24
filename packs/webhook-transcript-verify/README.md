# webhook-transcript-verify

## Run flow
```bash
reach pack validate packs/webhook-transcript-verify
reach run packs/webhook-transcript-verify
reach export <run-id>
reach replay <run-id>
```

## Expected outputs
- Validation passes.
- Run logs a normalized webhook transcript event.
- Export writes transcript content that can be replayed.
- Replay returns a matching deterministic fingerprint.

## Troubleshooting
- If webhook payload changes between runs, expect fingerprint differences.
- Keep payload normalization stable and sorted before hashing.
