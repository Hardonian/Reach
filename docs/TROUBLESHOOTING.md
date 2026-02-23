# Troubleshooting ReadyLayer Gates

Fast diagnosis for common integration and run issues.

| Symptom                 | Likely Cause                       | Fix                                            |
| :---------------------- | :--------------------------------- | :--------------------------------------------- |
| **Invalid signature**   | Webhook secret mismatch.           | Update `GITHUB_WEBHOOK_SECRET` in settings.    |
| **Duplicated runs**     | Multiple webhooks configured.      | Remove duplicate webhook entries in GitHub.    |
| **Check not appearing** | Missing `checks:write` permission. | Update GitHub App permissions to "Write".      |
| **Missing permissions** | App not installed on repo.         | Visit App Settings and install on target repo. |
| **Provider timeout**    | Model provider is unresponsive.    | Check provider status or increase run timeout. |
| **Tool timeout**        | Tool execution took too long.      | Optimize tool logic or adjust tool limits.     |
| **Invalid token**       | `READYLAYER_TOKEN` expired.        | Rotate token in the dashboard.                 |
| **Wrong repo selected** | CLI Repo/Token mismatch.           | Re-run `reach gate connect` for correct repo.  |
| **Branch mismatch**     | Gate limited to specific branch.   | Check Gate "Branch Filters" in dashboard.      |
| **CI not triggering**   | Missing `pull_request` trigger.    | Add `on: [pull_request]` to your YAML.         |
| **Rate limit**          | Too many concurrent runs.          | Upgrade plan or reduce parallel test volume.   |
| **Report link 404**     | Private report / No session.       | Ensure you are logged in to view reports.      |
