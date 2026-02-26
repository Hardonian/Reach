# CLI Semantic Governance Commands

## Commands
- `reach state show <id> [--json]`
- `reach state diff <idA> <idB> [--json]`
- `reach state graph [--since RFC3339] [--format json|dot|text]`
- `reach simulate upgrade --from <modelA> --to <modelB> --policy <policyRef> [--eval <evalRef>] [--json]`
- `reach verify-security [--json]`

All commands are local-first and fail with structured output instead of hard errors.
