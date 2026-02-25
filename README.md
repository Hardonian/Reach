# Reach Specifications

This directory contains the authoritative specifications for the Reach platform, organized by domain.

## Hierarchy

### 📜 [Protocol](protocol/)

**The Law.** Formal definitions of the Reach protocol, independent of implementation.

- [`EXECUTION_PROTOCOL.md`](protocol/EXECUTION_PROTOCOL.md): The core execution envelope and roles.
- `SPEC_FORMALIZATION_SUMMARY.md`: Summary of formal verification efforts.

### ⚙️ Runtime

**The Engine.** Specifications for the reference implementation (Runner).

- `EXECUTION_SPEC.md`: Normative execution contract.
- `GRAPH_EXECUTION_SPEC.md`: DAG-based execution model.
- `ADAPTIVE_ENGINE_SPEC.md`: Dynamic optimization logic.
- `MODEL_ROUTING_SPEC.md`: Model selection and fallback logic.

### 🌐 Federation

**The Network.** How Reach nodes communicate and trust each other.

- `FEDERATED_EXECUTION_SPEC.md`: Delegation and remote execution.
- `TRUST_NEGOTIATION_SPEC.md`: Handshakes and reputation scoring.

### 📦 Packaging

**The Container.** Formats for distribution and verification.

- `EXECUTION_PACK_SPEC.md`: The signed execution pack format.
- `AUTOPACK_SPEC.md`: Automated pack generation and scoring.
- `CAPABILITY_REGISTRY.md`: The source of truth for capabilities.

### 🏟️ Ecosystem

**The Product.** Specifications for user-facing surfaces.

- `ARCADE_SPEC.md`: The Arcade visual shell and playground.

### 💎 Determinism

**The Truth.** Technical and institutional foundations for verifiable execution.

- [`DETERMINISM_v1.0.md`](docs/specs/determinism-v1.0.md): Normative protocol fingerprinting spec.
- [`DETERMINISTIC_GOVERNANCE.md`](docs/whitepapers/deterministic-governance.md): Technical whitepaper on verifiable paths.
- [`SOC2_MAPPING.md`](docs/compliance/determinism-soc2-mapping.md): Compliance narrative for institutional trust.

---


*Note: These specifications are the source of truth. Code deviations from these specs are considered bugs.*
