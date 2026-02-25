# Git Host Integration (GitHub-first, GitLab-compatible)

## Current State
- GitHub webhook intake already exists via `apps/arcade/src/app/api/github/webhook/route.ts`.
- SCCL and CPX already emit machine-readable reports that can be posted as comments/check summaries.

## Integration Blueprint
1. **Authentication**
   - Prefer GitHub App installation tokens (short-lived) or OIDC exchange.
   - Avoid PAT/god-token usage.
2. **PR lifecycle**
   - Create or update PRs from reconciliation worker output.
   - Post DGL/CPX/SCCL summaries as PR comments.
3. **Checks and SARIF**
   - Publish CPX and DGL outcomes as check runs.
   - Upload SARIF produced by `scripts/cpx-cli.ts run`.
4. **Acknowledge flow**
   - Apply labels (`governance/ack-required`, `governance/approved`) from policy outputs.
5. **Review routing**
   - Auto-assign reviewers when high-risk zones are touched.

## Security Requirements
- Tokens must be installation-scoped and expiring.
- Logs must redact webhook secrets and bearer credentials.
- All outbound mutation actions include tenant/workspace IDs in audit entries.
