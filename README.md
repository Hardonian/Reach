# Reach: The Deterministic Spine for Agentic Intelligence

[![CI Status](https://github.com/reach/reach/actions/workflows/ci.yml/badge.svg)](https://github.com/reach/reach/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.3.1-blue.svg)](VERSION)

Reach is a high-performance, deterministic decision engine designed for autonomous agents and complex workflows. Built with a Rust core for precision and a TypeScript wrapper for flexibility, Reach provides the cryptographic provenance and bit-identical replayability required for production-grade agentic systems.

---

## 🚀 Start Here (2 Minutes)

```bash
# Clone and setup
git clone https://github.com/reach/reach.git
cd reach
npm install

# Run your first example
node examples/01-quickstart-local/run.js

# Check system health
./reach doctor
```

## 📚 Where to Start

| Goal | Go To |
|------|-------|
| **See it in action** | [examples/01-quickstart-local/](examples/01-quickstart-local/) |
| **Understand the workflow** | [examples/04-action-plan-execute-safe/](examples/04-action-plan-execute-safe/) |
| **Try policy governance** | [policy-packs/README.md](policy-packs/README.md) |
| **Create an extension** | [plugins/template/](plugins/template/) |
| **Full tutorial** | Run examples 01-06 in order |

### Quick Examples

```bash
# Run all 6 adoption examples
node examples/01-quickstart-local/run.js
node examples/02-diff-and-explain/run.js
node examples/03-junction-to-decision/run.js
node examples/04-action-plan-execute-safe/run.js
node examples/05-export-verify-replay/run.js
node examples/06-retention-compact-safety/run.js
```

## 🧠 Core Concepts

- **Deterministic Execution** - Same input → same output, always
- **Evidence Chain** - Cryptographically linked: Input → Policy → Execution → Output
- **Fingerprint** - SHA-256 hash for verification and replay
- **Junction** - Decision point with multiple evaluated options
- **Policy Pack** - Reusable governance rules (safety, cost, quality)
- **Plugin** - Safe extensions for custom analyzers and renderers

## 📖 Documentation

- [Examples Library](examples/README.md) - 6 hands-on tutorials
- [Policy Packs](policy-packs/README.md) - 8 governance presets
- [Plugin Development](plugins/README.md) - Extension guide
- [Documentation Index](docs/README.md)
- [Architecture & Design](docs/architecture.md)
- [CLI Reference](docs/cli.md)
- [Troubleshooting](docs/troubleshooting.md)

## 🛠️ Installation

### Requirements

- **Node.js** 18+ (for tooling and examples)
- **Go** 1.23+ (for backend services)
- **Rust** stable (for core engine)
- **SQLite** 3.35+ (database)

### Quick Install

```bash
# Verify dependencies
./reach doctor

# Run full verification
npm run verify:full
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed setup.

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Quick Contribution Path

1. **Run examples** - Try `examples/01-quickstart-local/`
2. **Find an issue** - Look for `good-first-issue` labels
3. **Make a change** - Follow our [CONTRIBUTING.md](CONTRIBUTING.md)
4. **Submit PR** - Use our PR template

### What to Contribute

- **Examples** - Add real-world use cases to `examples/`
- **Policy Packs** - Create governance presets in `policy-packs/`
- **Plugins** - Build extensions in `plugins/`
- **Docs** - Fix typos, clarify explanations
- **Tests** - Improve coverage

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Code style guidelines
- Where to add examples/policy packs/plugins
- Good first issues

## 💬 Getting Help / Feedback

### Questions & Discussion

- **GitHub Discussions** - For questions, ideas, and general discussion
- **Examples** - Check [`examples/`](examples/) for working code patterns

### Issues & Bugs

- [Bug Report](../../issues/new?template=bug_report.yml)
- [Feature Request](../../issues/new?template=feature_request.yml)
- [Doc Improvement](../../issues/new?template=doc_improvement.yml)

### Response Times

- Bugs: 48 hours acknowledgment
- Features: 1 week triage
- PRs: 48 hours initial review

## 🛡️ Security

Security is paramount. Please review our [SECURITY.md](SECURITY.md) for:
- Reporting vulnerabilities
- Threat model
- Security best practices

Reach includes a built-in dependency firewall to ensure ecosystem integrity.

## 📦 Project Structure

```
reach/
├── examples/          # 6 hands-on tutorials
├── policy-packs/      # 8 reusable governance presets
├── plugins/           # Extension template + 3 samples
├── src/               # TypeScript source
├── services/runner/   # Go backend
├── crates/            # Rust engine
├── docs/              # Documentation
└── tests/             # Integration tests
```

## 📝 License

MIT - See [LICENSE](LICENSE)

---

_Reach: Reducing entropy in autonomous systems._
