# Project Governance

Reach is an open-source project dedicated to deterministic execution. This document outlines how the project is governed.

## Decision Making

Decisions are made based on technical merit and alignment with the **Core Principles** (Determinism, Policy, Signed Packs).

### Architectural Decision Records (ADR)
Major changes must be proposed via an ADR in the `docs/adr` directory. This ensures that every significant structural decision is documented and auditable.

## Roles

### Maintainers
Maintainers have write access to the repository and are responsible for:
- Reviewing and merging Pull Requests.
- Maintaining the roadmap.
- Ensuring CI stability.
- Upholding the Code of Conduct.

### Contributors
Anyone can be a contributor by submitting code, documentation, or feedback. After a sustained period of high-quality contributions, a contributor may be nominated as a Maintainer.

## Plugin & Connector Ecosystem
Reach is designed to be extensible. While the core engine is tightly controlled for determinism, the MCP connector marketplace is open for community contributions. Every connector undergoes an automated security and drift audit before being listed as "Verified".
