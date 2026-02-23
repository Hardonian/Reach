# Reach Documentation Index

Welcome to the Reach Documentation. This directory contains the externally-facing reference material for operating, configuring, and deploying Reach.

_(Note: Internal architecture specifications and planning documents have been moved to `docs/internal/` and are not required reading for standard usage)._

## 🚀 Getting Started

- [Quickstart (Technical)](QUICKSTART_TECH.md) - Get up and running with the CLI and Rust engine in 5 minutes.
- [Quickstart (Non-Technical)](QUICKSTART_NON_TECH.md) - High-level overview of running pre-built workflows.
- [Install Guide](INSTALL.md) - Detailed installation instructions for all platforms.
- [Install Modes](INSTALL_MODES.md) - Guidance on different deployment topologies.
- [CLI Reference](cli.md) - Comprehensive command-line documentation for `reachctl` and `./reach`.

## 🏗️ Core Architecture

- [Architecture Overview](architecture.md) - High-level overview of the Reach system design.
- [Decision Lifecycle](decisions.md) - How decisions are structured, evaluated, and resolved.
- [Rust Decision Engine](decision-engine-rust.md) - Deep dive into the deterministic core engine.
- [Policy Gates](POLICY_GATE.md) - How governance and safety constraints are enforced.
- [Federated Execution](FEDERATION.md) - Multi-node execution protocols.
- [Network Topology](TOPOLOGY.md) - P2P and mesh connectivity.
- [Stability Contract](stability.md) - Stability guarantees and versioning policy.
- [Scaling Analysis](scaling.md) - Theoretical and practical scaling limits.
- [Threat Model](threat-model.md) - Abuse scenarios and security mitigations.

## ⚙️ Operations & Configuration

- [Configuration as Code](config-as-code.md) - Managing Reach setup declaratively.
- [Role-Based Access Control](rbac.md) - Security and permissions (RBAC) setup.
- [Traceability](traceability.md) - Understanding logging and execution provenance.
- [Error Codes](ERROR_CODES.md) - Explanation of system error classifications.
- [Error Code Registry](ERROR_CODE_REGISTRY.md) - Standardized failure taxonomy and specific codes.

## 🛠️ Debugging & Testing

- [Troubleshooting](troubleshooting.md) - Resolving common issues in deployment or execution.
- [Determinism Debugging](DETERMINISM_DEBUGGING.md) - How to diagnose and fix reproducibility failures.
- [Smoke Testing](testing-smoke.md) - Verifying basic operational health.
- [Benchmarking](BENCHMARKING.md) - Performance measurement methodologies.

---

_Reach: Reducing entropy in autonomous systems._
