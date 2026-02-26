# Differentiation Proof Checklist

1. Create semantic state fixture in local registry.
   - `reach state graph --format json`
2. Inspect state.
   - `reach state show <id>`
3. Compare transitions semantically.
   - `reach state diff <idA> <idB>`
4. Simulate governed model migration.
   - `reach simulate upgrade --from model-a --to model-b --policy policies/main.rego`
5. Verify integrity posture locally.
   - `reach verify-security`
6. Open cloud governance pages.
   - `/console/governance/semantic-ledger`
   - `/console/governance/transition-viewer`
7. Run route safety check.
   - `npm run verify:routes`
