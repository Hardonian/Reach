# Cross-Layer High-Priority Summary

## Top 10 Highest-Leverage Next Steps

| Priority | Action | Risk reduction impact | Adoption impact | Strategic moat impact |
|---|---|---|---|---|
| 1 | Standardize mutation audit envelope (`tenant_id`, `actor`, `run_id`, `workspace_id`) across all control planes. | Very high | Medium | High |
| 2 | Enforce policy-engine evaluation for every write path (CLI, web APIs, CPX resolve, release gates). | Very high | Medium | High |
| 3 | Complete Git host check/comment/label pipeline using short-lived installation tokens. | High | High | Medium |
| 4 | Keep reconciliation loop always-on for stale branches, missing runs, drift, and lease renewal. | High | Medium | High |
| 5 | Harden artifact registry invariants (content hash integrity + run linkage + retention). | High | Medium | High |
| 6 | Require CPX conflict packet acknowledgement before high-risk merges. | High | Medium | Very high |
| 7 | Expand provider SDK conformance and publish adapter certification criteria. | Medium | High | High |
| 8 | Deliver one onboarding flow spanning `reach init` through first governed PR demo. | Medium | Very high | Medium |
| 9 | Add governance SLO dashboards (determinism, policy latency, reconciliation lag, redaction failures). | Medium | Medium | High |
| 10 | Institutionalize quarterly threat-model + supply-chain drills with tracked remediation. | High | Medium | Medium |

## Why this ordering

- Items 1–6 reduce immediate governance and split-brain risk while preserving OSS-first operation.
- Items 7–8 accelerate ecosystem and operator adoption.
- Items 9–10 create measurable reliability and security loops needed for enterprise trust.

