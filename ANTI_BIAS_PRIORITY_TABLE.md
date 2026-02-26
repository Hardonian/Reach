# Anti-Bias Priority Table

Ranking is based on adoption lift, trust lift, revenue impact, risk reduction, and onboarding friction reduction.

| Feature | Persona | Impact (1-5) | Effort (S/M/L) | Bias origin | Should ship before public launch? (Yes/No) |
|---|---|---:|---|---|---|
| Route/nav integrity (remove dead links or implement pages) | All | 5 | S | Architecture-map-first bias | Yes |
| Real API key lifecycle UI (create/revoke/rotate/show-once) | Platform Engineer, Security Reviewer | 5 | M | Backend-complete mindset | Yes |
| Audit log UI with filter/export/signature context | Security Reviewer, CTO | 5 | M | Compliance signaling over reviewer workflow | Yes |
| "What failed?" explainer from report -> root cause -> fix | ML Engineer, Platform Engineer | 5 | M | Replay/proof depth over remediation UX | Yes |
| Policy/gate rollback with audit reason | Platform Engineer, Security Reviewer | 5 | M | Integrity primitives over operational safety controls | Yes |
| Enterprise identity baseline (SAML/SCIM) or explicit claim downgrade | Security Reviewer, CTO | 5 | L | Claim-forward enterprise narrative | Yes |
| Real trace explorer wired to live run data | Platform Engineer, ML Engineer | 4 | M | Demo-visualization bias | Yes |
| Integration setup wizard with live connection tests | Platform Engineer | 4 | M | UI aesthetics over setup completion | Yes |
| Server-side onboarding persistence | CTO, Platform Engineer | 4 | S | Local-first default bias | Yes |
| Alert delivery reliability ledger (retry/dead-letter visibility) | Platform Engineer | 4 | M | Alert dispatch backend without operator UX | Yes |
| Monitoring trend + SLO burn dashboards | CTO, Platform Engineer | 4 | M | Snapshot-card bias | No |
| Policy impact simulator (dry-run diff before enforce) | Security Reviewer, ML Engineer | 4 | M | Governance semantics over usability | No |
| Role editor with scoped custom roles | Security Reviewer | 4 | M | Enforcement-first RBAC mindset | No |
| Surface enterprise governance analytics UI (API already exists) | CTO | 3 | S | Hidden-feature bias | No |
| Scheduled executive reports (email/PDF/CSV) | Non-technical stakeholder, CTO | 4 | M | "Too boring" deprioritization | Yes |
| Incident comms workflow (subscriptions + postmortems) | CTO, Non-technical stakeholder | 4 | M | Internal runbook bias vs external trust UX | No |
| Reality-based changelog pipeline (auto-sourced) | OSS Maintainer, CTO | 3 | M | Narrative curation bias | No |
| Ownership/runbook metadata on signals/gates | Platform Engineer | 4 | S | Architecture depth over operations hygiene | Yes |

## Read this table correctly
- “Yes” items are not the most elegant architecture work. They are the work that prevents credibility collapse during first contact.
- Several “No” items are still high-value, but can follow once launch trust is stabilized.
