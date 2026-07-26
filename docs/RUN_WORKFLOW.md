# Governed run workflow

Reach records DGL runs under `dgl/run-records/<run_id>.json`. Each record now includes `status` (`passed` or `failed`) and `governed: true`.

- `npm run reach:run:status -- --id <run_id>` reports the status and violations; it exits non-zero for a failed run.
- `npm run reach:run:export -- --id <run_id> --zip <path>` exports the run record and referenced reports. Export validates every referenced path and passes arguments to `zip` without shell interpolation.

This is an evidence workflow, not a claim that a run passed: status is derived from recorded error-severity violations.
