# Attack Surface Audit

## Inventory
- CLI entry points: `reachctl` subcommands including new `cache`, `memory hash`, `validate remote`.
- Web endpoints: `reach-remote-validate` (`/health`, `/public-key`, `/validate`).
- Capsule import/verify surface: JSON parsing + deterministic replay hash checks.
- File I/O: capsule read paths, CAS object directories.

## Hardening Implemented
- Path cleaning before local reads in memory hashing command.
- Input size limit (10MiB) for remote validation payloads.
- Strict JSON decoder with unknown-field rejection on `/validate`.
- Explicit protocol version checks.
- In-flight request limit returning `429`.
- Explicit structured error JSON, no silent truncation.

## Remaining Risks
- Trusted-runner mode: validator executes in-process and does not currently isolate CPU/memory via OS sandbox.
- Operator trust remains local: signed reports prove service identity, not service operator honesty.
