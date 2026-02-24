# file-integrity-run

## Run flow
```bash
reach pack validate packs/file-integrity-run
reach run packs/file-integrity-run
reach export <run-id>
reach replay <run-id>
```

## Expected outputs
- Validation passes.
- Run emits deterministic integrity hash output.
- Export captures hash evidence in transcript.
- Replay confirms identical run fingerprint.

## Troubleshooting
- Ensure source files are unchanged between run and replay.
- Use stable file ordering when building input lists.
