# Testing a Pack

## Fast checks
```bash
reach pack validate <path>
reach pack lint <path>
reach pack test <path>
```

## Smoke workflow
```bash
reach run <path>
reach export <run-id>
reach replay <run-id>
```

## Troubleshooting
- Validation errors: fix manifest structure or missing files.
- Replay mismatch: remove non-deterministic inputs and rerun.
- Lint issues: update metadata and declared tools/permissions.
