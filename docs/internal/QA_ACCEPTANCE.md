# QA Acceptance Checklist: Reliability Gates

## Preconditions

- GitHub App installed.
- Repository connected via `reach gate connect`.
- Presets configured.

## Test Cases

### 1. Webhook Storm Handling

- **Steps:** Send 50 webhooks in 3 seconds.
- **Expected:** All processed without system lag. Metrics recorded.

### 2. Duplicate Delivery Guard

- **Steps:** Re-deliver same webhook payload via GitHub UI.
- **Expected:** Only one run triggered (idempotent). Secondary delivery ignored.

### 3. Tool Timeout Stability

- **Steps:** Mock a tool failing to return for 60s.
- **Expected:** Stable "Failed" state. Finding clearly describes timeout.

### 4. Actionable Finding Verification

- **Steps:** Force a policy violation (e.g. invalid pack).
- **Expected:** Finding block clearly describes which policy failed and how to fix.

### 5. Commit Continuity

- **Steps:** Push a new commit to an existing Pull Request.
- **Expected:** Active check run updates to the new Head SHA.

### 6. Rerun Integrity

- **Steps:** Click "Re-run" on the check in GitHub.
- **Expected:** Fresh run starts immediately. Summary and details update on completion.

### 7. Reliability Definition

- **Definition:** 99.9% successful delivery and processing of checks.
- **Verification:** Monitor `gate_run` status codes over 1000 automated runs.

### 8. Metrics Instrumentation

- **Steps:** Execute 10 runs with various outcomes.
- **Expected:** Dashboard shows accurate Latency, XP, and Pass Rate updates.
