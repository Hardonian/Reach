# Reach

[![CI Status](https://github.com/reach/reach/actions/workflows/ci.yml/badge.svg)](https://github.com/reach/reach/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.3.1-blue.svg)](VERSION)
[![Go Report Card](https://goreportcard.com/badge/github.com/reach/reach)](https://goreportcard.com/report/github.com/reach/reach)

Reach is a high-performance, deterministic decision engine for autonomous agents and complex workflows. It provides the cryptographic provenance and bit-identical replayability required to build production-grade, auditable AI systems.

---

## Reality Mode (v0.1)

- What is real and production-grade: The deterministic execution engine, policy evaluations, and replay integrity.
- What is optional: LLM planner bindings.
- What is explicitly removed: Mesh networking, consensus simulation, and poee theatre have been purged.
- What is intentionally out-of-scope for OSS: Multi-tenant operations and deep telemetry integrations.

## 📦 Installation

### Pre-built Binaries

Download pre-built binaries for your platform from the [releases page](https://github.com/reach/reach/releases):

```bash
# Linux/macOS - Using install script
curl -sSL https://github.com/reach/reach/releases/latest/download/install.sh | bash

# Or manually download and install
VERSION=$(curl -s https://raw.githubusercontent.com/reach/reach/main/VERSION)
curl -L -o reachctl https://github.com/reach/reach/releases/download/v${VERSION}/reachctl-linux-amd64
curl -L -o reach https://github.com/reach/reach/releases/download/v${VERSION}/reach
chmod +x reachctl reach
sudo mv reachctl reach /usr/local/bin/
```

### Build from Source

Requirements: Go 1.22+, Node.js 18+

```bash
# Clone the repository
git clone https://github.com/reach/reach.git
cd reach

# Build using Make
make build

# Or install to system
sudo make install

# Verify installation
reach version
```

### Platform Support

| Platform | Architecture | Status |
|----------|-------------|--------|
| Linux    | AMD64       | ✅ Supported |
| Linux    | ARM64       | ✅ Supported |
| macOS    | AMD64       | ✅ Supported |
| macOS    | ARM64       | ✅ Supported (Apple Silicon) |
| Windows  | AMD64       | ✅ Supported |

## ⚡ 60-Second Quickstart

```bash
# 1. Check installation
reach doctor

# 2. Run quick demo
make demo

# 3. Or run examples directly
node examples/01-quickstart-local/run.js
```

## 💻 CLI Example

Reach verifies decisions deterministically. Here is an example of running a decision workflow:

```console
$ reachctl explain decision-01.json
✔ Workflow parsed successfully
✔ Deterministic evaluation verified (Hash: 9f86d081884c7d659a2feaa0c55ad015)
✔ Policy checks passed

Result: Approved
Confidence: 0.98
Execution Time: 14ms
```

## 🌐 Web Demo

Experience the deterministic visualization of decisions and evidence chains.

1. Start the web simulator:
   ```bash
   pnpm run demo
   ```
2. Open [http://localhost:3000](http://localhost:3000) to view the execution graph.

_(For a live hosted environment, check out our [Playground](docs/PLAYGROUND.md))_

## 🧠 How It Works

Reach removes unpredictable AI loops by enforcing a structured lifecycle:

1. **Input**: Data is ingested and fingerprinted.
2. **Policy Verification**: Rules (like budget limits or safety checks) evaluate the input before execution.
3. **Execution**: The underlying decision engine evaluates all possible branches systematically.
4. **Evidence Chain**: Every outcome is cryptographically linked back to its policy, input, and exact evaluation state, making it mathematically provable and replayable.

## 🚀 Demo Flow Instructions

Want to see Reach’s full capabilities without writing code? We have a complete adoption walkthrough:

```bash
# Run all core examples to see Reach in action:
node examples/01-quickstart-local/run.js
node examples/02-diff-and-explain/run.js
node examples/03-junction-to-decision/run.js
node examples/04-action-plan-execute-safe/run.js
node examples/05-export-verify-replay/run.js
node examples/06-retention-compact-safety/run.js
```

## 📖 Documentation

Full documentation is available in the [docs site](apps/docs/):

- [Quickstart](apps/docs/app/docs/quickstart) - Get up and running in 60 seconds
- [Examples](apps/docs/app/docs/examples) - Six complete walkthroughs
- [Presets](apps/docs/app/docs/presets) - Choose your starting path
- [Plugins](apps/docs/app/docs/plugins) - Extend Reach
- [Troubleshooting](apps/docs/app/docs/troubleshooting) - Debug and bug reports
- [Stability](apps/docs/app/docs/stability) - Versioning and roadmap

Run locally:

```bash
pnpm run docs:dev     # http://localhost:3001
pnpm run docs:build   # Static export
```

## 🤝 Contributing

We actively welcome community contributions! Please review our [Contribution Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) to learn how to:

- Set up your local development environment
- Run the test suite
- Submit Pull Requests
- Follow our coding standards
- Where to add [examples](examples/), [presets](presets/), and [plugins](plugins/)

## 💬 Feedback & Discussions

- **Found a bug?** Submit a [Bug Report](../../issues/new?template=bug_report.yml).
- **Have an idea?** Submit a [Feature Request](../../issues/new?template=feature_request.yml).
- **Need help?** Start a thread in our [GitHub Discussions](../../discussions).

## 🗺️ Stability & Roadmap Transparency

Reach is currently in **Beta (0.3.x)**.

- **Core Engine**: The Rust deterministic evaluate loop is stable.
- **APIs**: Minor structural changes may occur prior to 1.0.
- **Backwards Compatibility**: State migrations are provided for all breaking changes.

View our public roadmap and upcoming milestones in the [GitHub Projects Board](../../projects).

---

## 📝 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
