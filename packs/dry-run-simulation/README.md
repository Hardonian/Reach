# dry-run-simulation

## Run flow
```bash
reach pack validate packs/dry-run-simulation
reach run packs/dry-run-simulation
reach export <run-id>
reach replay <run-id>
```

## Expected outputs
- Validation passes.
- Run reports simulation-only result with no side effects.
- Export provides transcript for offline review.
- Replay verifies deterministic matching output.

## Troubleshooting
- This pack is a dry run only; it does not assert distributed consensus.
- If behavior differs across runs, remove environment-dependent inputs.
