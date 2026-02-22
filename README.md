# Reach: The Deterministic Spine for Agentic Intelligence

[![CI Status](https://github.com/reach/reach/actions/workflows/ci.yml/badge.svg)](https://github.com/reach/reach/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](VERSION)

Reach is a high-performance, deterministic decision engine designed for autonomous agents and complex workflows. Built with a Rust core for precision and a TypeScript wrapper for flexibility, Reach provides the cryptographic provenance and bit-identical replayability required for production-grade agentic systems.

---

## 🚀 Start Here

### Installation

Reach requires Node.js 18+, Go 1.23+, and Rust stable.

```bash
# Clone and install
git clone https://github.com/reach/reach.git
cd reach
npm install

# Verify your environment
./reach doctor
```

### Quickstart

Initialize a new decision workspace and run a deterministic analysis:

```bash
# Start a new decision
./reach workflow start --title "Infrastructure Migration"

# Add evidence/notes
./reach workflow add-note --text "Load balancer capacity verified"

# Run the decision engine
./reach workflow run
```

### Example Command

Check the health and replay stability of your current decisions:

```bash
./reach workflow decision-health --json
```

---

## 🧠 Core Concepts

- **Determinism First**: Every decision produced by Reach can be replayed and verified with bit-identical results, regardless of when or where it is executed.
- **Evidence Chains**: All inputs are cryptographically hashed and linked to provide an immutable audit trail of provenance.
- **Policy Gates**: Hardened architectural boundaries that prevent non-deterministic or unverified code from influencing core decision logic.
- **Zero-Cloud Lock**: Reach is designed to run anywhere—from local developer machines to air-gapped data centers.

---

## 📖 Documentation

- [Documentation Index](docs/README.md)
- [Architecture & Design](docs/ARCHITECTURE.md)
- [CLI Reference](docs/CLI.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [API Versioning](docs/API_VERSIONING.md)

---

## 🤝 Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and our [AGENTS.md](AGENTS.md) for guidelines on contributing AI-assisted code.

---

## 🛡️ Security

Security is paramount. Please review our [SECURITY.md](SECURITY.md) for reporting vulnerabilities and our threat model. Reach includes a built-in dependency firewall to ensure the integrity of the ecosystem.

---

*Reach: Reducing entropy in autonomous systems.*
