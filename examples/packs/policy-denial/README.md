# Policy Denial Example This example demonstrates how the policy gate denies execution of packs with high-risk permissions.

## What This Pack Demonstrates - **Policy enforcement**: The policy denies `sys:exec` permission
- **Governed execution**: Requires signing and verification
- **Denial recording**: Policy decisions are recorded in the event log

## The Policy The `policy.rego` file:
1. Defaults to deny all
2. Explicitly denies `sys:exec` permission
3. Requires pack signing
4. Requires verified publisher status

## Expected Behavior When this pack is executed:
1. The policy gate evaluates the request
2. The `sys:exec` permission triggers a denial
3. The denial is recorded in the event log
4. Execution is blocked

## Running ```bash
cd examples/packs/policy-denial
reach pack lint .
reach pack doctor .
```

Note: This pack will fail the doctor check because it's not signed, which is expected behavior.
