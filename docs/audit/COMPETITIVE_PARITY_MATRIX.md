# Competitive Expectation Parity Matrix (No Competitor Names)

## Classification legend
- **Above baseline**
- **Meets baseline**
- **Below baseline**
- **Misaligned focus**

| Capability Area | Classification | Stress-Test Read | Main Risk |
|---|---|---|---|
| Observability | Meets baseline | Basic health/metrics and governance visibility are present, but end-to-end operator-native incident flow is not yet obvious by default. | Operational teams may still need custom glue for mature incident response. |
| Audit export | Meets baseline | Strong evidence-chain narrative and audit emphasis; practical export workflows appear credible but can feel enterprise-tilted in framing. | Buyers may expect turnkey compliance package templates out-of-the-box. |
| Policy versioning visibility | Meets baseline | Policy version concepts are explicit and central. | Visibility exists, but “decision explanation” ergonomics can still bottleneck user trust in day-to-day use. |
| Rollback clarity | Below baseline | Governance and determinism are emphasized; rollback workflow storytelling is less operationally crisp than expected. | Incident commanders may not trust rollback speed under pressure. |
| API surface | Misaligned focus | Surface is broad and feature-rich, but breadth may exceed coherence for new evaluators. | API discoverability and prioritization debt can suppress integration velocity. |
| RBAC clarity | Below baseline | Security posture is visible, but role-boundary clarity feels less explicit than policy/evidence messaging. | Enterprise reviewers may ask for a simpler role model narrative. |
| Notification / alerting posture | Below baseline | Alerting appears as a UI concept, but response loops and default signal routing maturity are less obvious. | “Great controls, weak real-time ops pulse” criticism risk. |
| Change history transparency | Above baseline | Determinism + replay + evidence chain produce unusually strong historical traceability narrative. | Strength can be under-leveraged if UX to consume change history is too dense. |
| Deployment safety signals | Meets baseline | Verification and governance gates are robust in CI posture. | Safety appears process-heavy; teams may perceive throughput drag. |

## Synthesis
- **Strength cluster:** Change transparency, deterministic auditability, governance evidence.
- **Parity cluster:** Core observability and policy visibility.
- **Lag cluster:** Operator ergonomics (rollback clarity, RBAC simplification, alerting posture).
- **Misalignment cluster:** API and surface breadth advancing faster than narrative and onboarding compression.

## Bottom line
Reach now clears many credibility baselines, but it risks underperforming where fast-moving adopters expect frictionless operator workflows.
