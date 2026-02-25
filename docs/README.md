# Reach Documentation

Welcome to the authoritative reference for the Reach execution fabric.

## 🗺️ Navigation Pack

### Top 10 Entry Points

1. **[60-Second Proof](./CONCEPT_MAP.md)** - See the reality of Reach in action.
2. **[Quickstart](./QUICKSTART_TECH.md)** - Get up and running with the CLI.
3. **[Proof of Reality](./cli.md#reach-doctor)** - How we guarantee determinism.
4. **[CLI Reference](./cli.md)** - Comprehensive command list.
5. **[Architecture Overview](./architecture.md)** - How the system is designed.
6. **[Decision Lifecycle](./decisions.md)** - Branching and outcome logic.
7. **[Capsule Manual](./cli.md#reach-capsule)** - Managing portable proofs.
8. **[Configuration](./ENVIRONMENT_VARIABLES.md)** - Tuning the engine.
9. **[Troubleshooting](./troubleshooting.md)** - Resolving common failures.
10. **[Stability Contract](./stability.md)** - Versioning and roadmap.

### 🛤️ Start Here: Choose Your Path

| Path | Focus | Key Docs |
| :--- | :--- | :--- |
| **OSS Core** | Local execution, local registry, CLI usage. | [Quickstart](./QUICKSTART_TECH.md), [CLI](./cli.md) |
| **Enterprise** | Multi-node, auditing, deep compliance, billing. | [Governance](../GOVERNANCE.md), [RBAC](./rbac.md) |

---

## 🧠 Core Concept Map

Reach removes unpredictable AI loops by enforcing a structured lifecycle.

**[View the Full Concept Map & Diagram](./CONCEPT_MAP.md)**

```text
CLI/API Entry → Policy Gates → Deterministic Replay → Evidence Chain → Capsule Output
```

---

## ⚖️ Institutional Foundation

### 📜 [Specifications](./specs/index.md)

- **[Determinism v1.0](./specs/determinism-v1.0.md)**: The authoritative contract for cross-language fingerprinting.

### 📄 [Whitepapers](./whitepapers/index.md)

- **[Deterministic Governance](./whitepapers/deterministic-governance.md)**: Technical deep-dive into verifiable decision paths.

### 🛡️ [Compliance](./compliance/index.md)

- **[SOC2 Control Mapping](./compliance/determinism-soc2-mapping.md)**: Narrative and evidence mapping for institutional audits.

---

## 🏗️ Detailed Reference

- **Design**: [Architecture](./architecture.md), [Decisions](./decisions.md), [Topology](./TOPOLOGY.md), [Federation](./FEDERATION.md)
- **Operations**: [Install](./INSTALL.md), [Install Modes](./INSTALL_MODES.md), [Config](./ENVIRONMENT_VARIABLES.md), [Config as Code](./config-as-code.md), [RBAC](./rbac.md), [Scaling](./scaling.md)
- **Hardening**: [Determinism Debugging](./DETERMINISM_DEBUGGING.md), [Benchmarking](./BENCHMARKING.md), [Threat Model](./threat-model.md), [Traceability](./traceability.md)
- **CLI**: [CLI Reference](./cli.md), [CLI Completions](./cli-completions.md)
- **Policy**: [Policy Gate](./POLICY_GATE.md)
- **Development**: [Testing & Smoke](./testing-smoke.md), [Error Codes](./ERROR_CODES.md), [Error Code Registry](./ERROR_CODE_REGISTRY.md)
- **Getting Started**: [Quickstart Non-Technical](./QUICKSTART_NON_TECH.md), [Glossary](./glossary.md)
- **Engine**: [Decision Engine Rust](./decision-engine-rust.md)

---

_Reach: Reducing entropy in autonomous systems._
