# Gate Adoption Playbook

Winning strategies for transitioning users from Demo success to production Gates.

## Adoption Nudges

### 1. Post-Demo Dashboard Nudge

- **Location:** Header/Modal on `arcade` success.
- **Trigger:** 5 seconds after run completion.
- **Copy:** `Build with confidence. Enable Release Gates for your repo.`
- **Action:** Links to GitHub integration setup documentation. (CLI command `reach gate connect` coming in v0.4)

### 2. Adoption Sequence (Email)

- **Subject:** Protect your `[Repo Name]` with ReadyLayer Gates
- **Body:** Your agent is ready. Don't let a code change break it. Enable PR Gates to stop regressions before they hit production.
- **CTA:** `Set up Gate`

### 3. Notification Integration

- **Platform:** Slack/Discord
- **Template:** `🛡️ Gate enabled for [Repo Name]. Your agent is now protected against breaking changes.`

## Success Pathway

- **Goal:** Demo → Gate enabled in <10 minutes.
- **Metric:** Gate Activation Rate (GAR).
- **Target:** 40%+ of active users.

## High-Leverage Improvements

- **Zero-Config Discovery:** CLI detects existing `.github/workflows` and suggests exact YAML placement.
- **One-Click Presets:** Default to `Integrity Shield` for new connections.
- **Draft Reports:** Show what a gate report _would_ look like during the setup wizard.
