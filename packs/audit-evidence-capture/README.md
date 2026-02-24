# audit-evidence-capture

## Run flow
```bash
reach pack validate packs/audit-evidence-capture
reach run packs/audit-evidence-capture
reach export <run-id>
reach replay <run-id>
```

## Expected outputs
- Validation passes with no errors.
- Run creates one deterministic evidence step.
- Export produces a transcript artifact for audit review.
- Replay confirms fingerprint match.

## Troubleshooting
- If validate fails, confirm `pack.json` has `metadata` and `execution_graph.steps`.
- If replay mismatches, remove non-deterministic inputs from the run payload.
