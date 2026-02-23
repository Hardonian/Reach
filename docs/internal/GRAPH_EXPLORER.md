# Visual Execution Graph Explorer Reach provides CLI graph export:

- `reachctl graph export <runId> --format=json`
- `reachctl graph export <runId> --format=dot`
- `reachctl graph export <runId> --format=svg`

Exports include policy/delegation context and are deterministic for replay analysis.
