# Writing a Pack

## Required structure
- `pack.json` with `spec_version`, `metadata`, and `execution_graph.steps`.
- Optional `policy.rego` referenced by `policy_contract`.
- `README.md` with run/verify/replay commands.
- `transcripts/sample-transcript.json` for expected output guidance.

## Scaffold
```bash
reach pack init --template starter-policy-task my-pack
```

## Deterministic authoring checklist
1. Avoid time/random/network dependent task inputs.
2. Keep step ordering explicit with dependencies.
3. Keep transcript examples stable and sorted.
