# Run Capsule Format A Run Capsule is a deterministic ZIP bundle for replay and review.

## Layout - `manifest.json`: capsule metadata and file inventory.
- `events.ndjson`: ordered run event envelopes.
- `toolcalls.ndjson`: tool calls/results with redaction markers where needed.
- `audit.ndjson`: runner-side audit stream.
- `artifacts/`: optional exported patches and reports.

## Compatibility - `manifest.version` uses semver.
- Readers MUST reject unknown major versions.
- Writers MUST preserve event order exactly.
- Replay logic must treat gate decisions and tool results as explicit inputs.
