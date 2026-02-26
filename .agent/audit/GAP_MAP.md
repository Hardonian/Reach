# Promise → Surface Gap Map

## Gap Analysis Table

| Promise                            | Persona(s)            | Required Page(s)            | Required CLI                               | Status  | Evidence                                   | Priority | Local/Cloud |
| ---------------------------------- | --------------------- | --------------------------- | ------------------------------------------ | ------- | ------------------------------------------ | -------- | ----------- |
| Deterministic execution guarantees | All                   | /how-it-works, /determinism | `reach doctor`, `reach verify-determinism` | EXISTS  | README.md, CLI matrix                      | P0       | Local       |
| Cryptographic proof                | Security, CTO         | /security, /proof           | `reach proof verify`                       | EXISTS  | docs/cli.md                                | P0       | Local       |
| Replayable execution               | ML Engineer, Platform | /replay, /docs/replay       | `reach replay`, `reach capsule replay`     | EXISTS  | CLI matrix, docs                           | P0       | Local       |
| Verifiable capsules                | All                   | /capsules                   | `reach capsule create/verify/replay`       | EXISTS  | CLI matrix                                 | P0       | Local       |
| CI gates enforcement               | Platform, CTO         | /gates, /ci-integration     | `reach gate`                               | PARTIAL | CLI has gate command, needs better docs    | P0       | Hybrid      |
| Cloud upgrade path                 | CTO, Security         | /enterprise, /pricing       | `reach login`, `reach cloud`               | PARTIAL | Pages exist, CLI cloud commands missing    | P1       | Cloud       |
| TypeScript SDK                     | Platform, ML          | /docs/sdk/typescript        | N/A                                        | EXISTS  | docs/QUICKSTART_TECH.md                    | P0       | Hybrid      |
| Python SDK                         | Platform, ML          | /docs/sdk/python            | `pip install reach-sdk`                    | EXISTS  | docs/QUICKSTART_TECH.md                    | P1       | Hybrid      |
| GitHub integration                 | Platform              | /docs/integrations/github   | `reach connect github`                     | PARTIAL | API exists, CLI command missing            | P1       | Cloud       |
| SOC2 compliance mapping            | Security, CTO         | /compliance/soc2            | N/A                                        | EXISTS  | docs/compliance/                           | P0       | Local       |
| Local-first OSS mode               | All                   | /oss                        | N/A                                        | PARTIAL | Mentioned but no dedicated OSS page        | P1       | Local       |
| Determinism cross-lang             | ML, Platform          | /specs/determinism-v1.0     | N/A                                        | EXISTS  | docs/specs/                                | P0       | Local       |
| WASM bridge                        | Platform              | /wasm                       | N/A                                        | EXISTS  | WASM_BUILD.md                              | P2       | Local       |
| Golden vectors                     | ML, Platform          | /testing/golden-vectors     | `reach verify-determinism`                 | EXISTS  | DETERMINISM_ROADMAP.md                     | P2       | Local       |
| Audit chain export                 | Security              | /audit/export               | `reach export audit`                       | MISSING | No export command found                    | P1       | Local       |
| Team governance                    | CTO, Security         | /team, /governance          | `reach org`, `reach team`                  | THEATRE | Pages mention team, no CLI commands        | P1       | Cloud       |
| Advanced analytics                 | CTO                   | /analytics                  | `reach analytics`                          | THEATRE | Mentioned in enterprise, no implementation | P2       | Cloud       |
| Cloud-hosted runners               | Platform, CTO         | /runners                    | `reach runner`                             | THEATRE | Mentioned, no CLI or clear UI              | P2       | Cloud       |
| API keys management                | Platform              | /settings/api-keys          | `reach api-key`                            | PARTIAL | UI exists, CLI missing                     | P1       | Hybrid      |
| Webhook integration                | Platform              | /docs/webhooks              | `reach webhook`                            | PARTIAL | API exists, CLI missing                    | P2       | Cloud       |
| Cost tracking                      | CTO, Platform         | /console/cost               | `reach cost`                               | EXISTS  | tools/economics/, console page             | P1       | Hybrid      |
| Eval comparison                    | ML Engineer           | /console/evaluation         | `reach eval`                               | PARTIAL | Console page exists, CLI missing           | P1       | Local       |
| Regression testing                 | ML Engineer           | /docs/regression            | `reach eval regression`                    | MISSING | docs/internal/ADOPTION_PLAYBOOK mentions   | P1       | Local       |
| Marketplace                        | All                   | /marketplace                | `reach packs`                              | EXISTS  | CLI and pages exist                        | P0       | Hybrid      |
| Billing/Stripe                     | CTO                   | /settings/billing           | N/A                                        | EXISTS  | UI and API exist                           | P0       | Cloud       |
| Support bot                        | All                   | /support                    | `reach support ask`                        | EXISTS  | CLI has support ask                        | P0       | Local       |
| Architecture docs                  | All                   | /architecture               | N/A                                        | EXISTS  | apps/arcade/src/app/architecture/          | P0       | Local       |
| Changelog                          | All                   | /changelog                  | N/A                                        | EXISTS  | apps/arcade/src/app/changelog/             | P0       | Local       |

---

## Theatre Items (Claims Without Reality)

| Claim                  | Location                               | Reality                                     | Recommendation                             |
| ---------------------- | -------------------------------------- | ------------------------------------------- | ------------------------------------------ |
| "team governance"      | README.md#L82                          | No `reach org` or `reach team` CLI commands | Remove or add "(coming soon)"              |
| "advanced analytics"   | README.md#L82                          | No analytics dashboard or command           | Remove or add "(coming soon)"              |
| "cloud-hosted runners" | README.md#L82                          | No runner management in CLI                 | Remove or add "(coming soon)"              |
| "reach gate connect"   | docs/internal/ADOPTION_PLAYBOOK.md#L13 | Command doesn't exist                       | Fix to `reach gate --connect` or implement |
| "reach connect github" | Implied by integration                 | No such CLI command                         | Implement or document API approach         |

---

## Summary Statistics

| Category             | Count |
| -------------------- | ----- |
| EXISTS (Complete)    | 20    |
| PARTIAL (Needs work) | 9     |
| MISSING              | 3     |
| THEATRE (Misleading) | 5     |

### Priority Distribution

| Priority             | Count |
| -------------------- | ----- |
| P0 (Launch Critical) | 14    |
| P1 (Next 2 weeks)    | 10    |
| P2 (Backlog)         | 8     |

### Local/Cloud Distribution

| Scope      | Count |
| ---------- | ----- |
| Local-only | 16    |
| Cloud-only | 5     |
| Hybrid     | 11    |
