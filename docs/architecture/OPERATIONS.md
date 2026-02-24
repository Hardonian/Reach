# Operations Runbook

## Start / stop

### Start baseline checks

```bash
npm run validate:boundaries
npm run verify:full
go test ./...
```

### Stop / shutdown expectations

- Close storage drivers (`Close`) before process exit.
- Ensure canceled contexts are propagated to active storage operations.
- Avoid force-kill while writing artifacts; atomic write path now minimizes corruption risk.

## Recovery after interruption

1. Re-run failed workflow command with same inputs.
2. If read errors indicate stale artifact path, rewrite artifact via normal command path (same key) to self-heal metadata + blob pointer.
3. Re-run verification:

```bash
npm run verify:full
go test ./src/go/...
```

## Common failure modes and exact commands

- **Boundary drift:**
  - `npm run validate:boundaries`
- **Storage regression / interruption safety:**
  - `go test ./src/go/... -run TestSqliteDriverRecoversAfterInterruptedMetadataUpdate`
- **Cancellation propagation regression:**
  - `go test ./src/go/... -run TestSqliteDriverWriteRespectsCanceledContext`

## Safe debug checklist

- Confirm boundary guard passes before debugging runtime behavior.
- Reproduce with targeted test first, then full verify.
- Inspect artifact DB + blob path consistency only through non-mutating commands unless performing controlled recovery.
- After any fix, run both TypeScript and Go test suites before release.
