# Roadmap: Kilo & Deterministic CI Governance

## Milestone: Kilo (OSS Stability)
Focus: Rock-solid local execution and artifact management.

- **K1: Deterministic Storage**: All run artifacts hashed and stored in stable structure.
- **K2: Replay Protocol**: 100% bit-for-bit replay accuracy for local runs.
- **K3: CLI UX Polish**: Consistent help, error codes, and local state management.
- **K4: Plugin Sandboxing**: Ensure plugins cannot leak data or break determinism.

## Milestone: Mega (Enterprise Foundations)
Focus: Extensibility for hosted environments.

- **M1: Cloud Adapter Suite**: Formalize interfaces for Auth, Billing, and Sync.
- **M2: Multi-tenancy Isolation**: Sandbox logic for shared compute environments.
- **M3: Admin Dashboard**: Enterprise-grade visibility (stubbed in OSS).

## Milestone: Giga (Cloud Scale)
Focus: Hosted Reach as a Service.

- **G1: Infinite Scaling**: Stateless runner clusters.
- **G2: Global Registry**: Federated plugin discovery and ranking.
- **G3: Advanced Compliance**: Enterprise guardrails and PII scrubbing.

## Governance Rules
- No code merged without deterministic test vectors.
- Public APIs must remain backwards compatible (V1).
- Dependency sprawl is treated as a security vulnerability.
