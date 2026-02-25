# Project Governance

Reach is an open-source project committed to building high-performance, deterministic decision infrastructure. This document outlines how the project is governed.

## 1. Guiding Principles

- **Determinism Over Convenience**: We prioritize bit-identical replayability and cryptographic provenance.
- **Minimal Entropy**: We strive to reduce accidental complexity and structural drift.
- **Reality Over Theatre**: We prefer functional, verify-first logic over simulated or "ornamental" features.
- **Stability and Predictability**: Production-grade systems depend on Reach; we maintain high standards for breaking changes and migrations.

## 2. Maintainership

### Benevolent Dictator for Life (BDFL)

The project's founder (Hardonian) serves as the BDFL, with final authority over architectural decisions and project direction.

### Core Maintainers

Core maintainers have write access to the repository and are responsible for:

- Reviewing and merging Pull Requests.
- Maintaining CI/CD infrastructure.
- Managing releases and versioning.
- Enforcing the Code of Conduct.

## 3. Decision Process

Major changes (architectural shifts, new core engines, breaking API changes) follow this process:

1. **Proposal**: Open an Issue or Discussion titled `[PROPOSAL] title`.
2. **Review**: Maintainers and community members provide feedback.
3. **Consensus**: We aim for consensus but prioritize architectural coherence. The BDFL has the final say.
4. **Implementation**: Once approved, a Pull Request can be submitted.

## 4. Contributing

We welcome contributions from everyone. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for technical guidance.

## 5. Conflict Resolution

Conflicts are resolved through open discussion in the community forum. If a resolution cannot be reached, the core maintainers will mediate. The BDFL serves as the final arbitrator.

## 6. Communication Channels

- **GitHub Issues**: Technical bugs and feature requests.
- **GitHub Discussions**: General questions, proposals, and community interaction.
- **Discord**: Real-time coordination for core development (invitation required for core work).

---

_This document is subject to change as the project evolves._
