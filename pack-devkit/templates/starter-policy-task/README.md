# {{PACK_NAME}}

Starter template for a governed deterministic pack.

## Included
- Minimal policy contract (`policy.rego`).
- One deterministic task (`execution_graph.steps[0]`).
- Sample transcript output (`transcripts/sample-transcript.json`).

## Commands
```bash
reach pack validate .
reach pack lint .
reach run .
reach export <run-id>
reach replay <run-id>
```

## Expected output
- `reach pack validate .` reports pass.
- `reach run .` emits deterministic output from `task-1`.
- `reach replay <run-id>` confirms matching fingerprint.

## Verify/replay checklist
1. Run once and capture run id.
2. Export run transcript.
3. Replay the run id or transcript.
4. Confirm no mismatch in replay output.

## Troubleshooting
- If validation fails, check required fields in `pack.json`.
- If replay mismatches, verify task input/output does not depend on time or randomness.
