# Reach + ReadyLayer Onboarding Flow

## Goal

Get a new workspace from zero to its first governed pull request without bypassing policy gates.

## CLI Flow

1. `reach init`
   - Initializes local workspace metadata and deterministic defaults.
2. `reach connect-repo`
   - Registers repository identity and governance context.
3. `reach enable-gates`
   - Enables policy, DGL, and SCCL enforcement on mutation paths.
4. `reach first-run`
   - Executes first governed run and generates run-linked artifacts.

## Web Flow

1. Open **Connect Repository** wizard.
2. Install Git host app for selected repository/workspace.
3. Generate workspace manifest + governance defaults.
4. Run **First PR demo** to verify checks/comments/labels pipeline.

## First PR Success Criteria

- DGL summary posted.
- CPX packet summary attached (or no-conflict assertion).
- SCCL gate status present.
- Policy decision logged with actor + tenant + run IDs.
- No hard-500 API responses during flow.

## Operator Validation Checklist

- Verify webhook signatures are accepted and logged safely.
- Verify labels/reviewers are applied per policy.
- Verify artifact references are content-addressed and run-linked.
- Verify rollback path: disable gates and recover gracefully.

## Troubleshooting

- If webhook signatures fail, rotate secret and retry via dry-run replay.
- If SCCL lease cannot be renewed, pause auto-mutation and require manual acknowledgement.
- If policy blocks merge, surface explicit rule IDs and remediation in PR comment.

