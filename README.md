# Reach

[![CI Status](https://github.com/reach/reach/actions/workflows/ci.yml/badge.svg)](https://github.com/reach/reach/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.3.1-blue.svg)](VERSION)
[![Go Report Card](https://goreportcard.com/badge/github.com/reach/reach)](https://goreportcard.com/report/github.com/reach/reach)

Reach is a high-performance, deterministic decision engine for autonomous agents and complex workflows. It provides the cryptographic provenance and bit-identical replayability required to build production-grade, auditable AI systems.

---

## Reality Mode (v0.1)

- What is real and production-grade: The deterministic execution engine, policy evaluations, and replay integrity.
- What is optional: LLM planner bindings, cloud/billing integrations, and enterprise analytics surfaces.
- What is explicitly removed: Mesh networking, consensus simulation, and poee theatre have been purged.
- What is intentionally out-of-scope for OSS: Multi-tenant operations and deep telemetry integrations.

## 📦 Installation

### Pre-built Binaries

Download pre-built binaries for your platform from the [releases page](https://github.com/reach/reach/releases):

```bash
# Linux/macOS (checksums verified)
curl -fsSL https://github.com/reach/reach/releases/latest/download/install.sh | bash

# Manual install with checksum verification
VERSION=$(curl -s https://raw.githubusercontent.com/reach/reach/main/VERSION)
BASE="https://github.com/reach/reach/releases/download/v${VERSION}"
curl -fsSL -O "${BASE}/reachctl-linux-amd64"
curl -fsSL -O "${BASE}/reach"
curl -fsSL -O "${BASE}/SHA256SUMS"
grep "reachctl-linux-amd64" SHA256SUMS | sha256sum -c -
grep "reach$" SHA256SUMS | sha256sum -c -
chmod +x reachctl-linux-amd64 reach
sudo mv reachctl-linux-amd64 /usr/local/bin/reachctl
sudo mv reach /usr/local/bin/reach
```

```powershell
# Windows PowerShell installer (checksums verified)
irm https://github.com/reach/reach/releases/latest/download/install.ps1 | iex
```

### Build from Source

Requirements: Go 1.22+, Node.js 20+

```bash
# 1. Clone the repository
git clone https://github.com/reach/reach.git
cd reach

# 2. Install dependencies
npm install

# 3. Build binaries
make build

# 4. Verify your setup
./reach version
./reach doctor

# Or install to system
sudo make install

# Verify installation
reach version
```

### Platform Support

| Platform | Architecture | Status                       |
| -------- | ------------ | ---------------------------- |
| Linux    | AMD64        | ✅ Supported                 |
| Linux    | ARM64        | ✅ Supported                 |
| macOS    | AMD64        | ✅ Supported                 |
| macOS    | ARM64        | ✅ Supported (Apple Silicon) |
| Windows  | AMD64        | ✅ Supported                 |

## ⚡ 10-Minute Quickstart

1. **Verify Environment**:

   ```bash
   ./reach doctor
   ```

2. **Run One Command Demo**:

   ```bash
   ./reach demo
   ```

3. **Collect a Support Bundle (optional)**:

   ```bash
   ./reach bugreport
   ```

### 🚩 Common Pitfalls & Fixes

- **"Go binary not found"**: Ensure `go` is in your PATH. Reach needs Go 1.22+.
- **"better-sqlite3" install failure**: You may need build tools (`gcc`, `g++`) for Node.js native modules.
- **"Non-deterministic drift detected"**: If you modified core engine logic, ensure you aren't using `time.Now()` or unsalted hashes. Use `codeshift` or `codePointCompare` for strings.
- **"Permission denied"**: The `reach` wrapper needs execution permissions: `chmod +x reach`.

## 💻 CLI Example

Reach verifies decisions deterministically with replayable artifacts:

```console
$ reach demo
Demo smoke completed.
Run ID: run-...
Capsule: data/capsules/run-....capsule.json
Verified: true
Replay Verified: true
```

## 🌐 Web Demo

Experience the deterministic visualization of decisions and evidence chains.

1. Start the web simulator:

   ```bash
   npm run dev --workspace arcade
   ```

2. Open [http://localhost:3000](http://localhost:3000) to view the execution graph.

_(For a live hosted environment, check out our [Playground](https://reach.dev/playground))_

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

Full documentation is available at [reach-cli.com](https://reach-cli.com) and in the local [docs site](apps/docs/):

- [Quickstart](apps/docs/app/docs/quickstart) - Get up and running in 60 seconds
- [Examples](apps/docs/app/docs/examples) - Six complete walkthroughs
- [Presets](apps/docs/app/docs/presets) - Choose your starting path
- [Plugins](apps/docs/app/docs/plugins) - Extend Reach
- [Troubleshooting](apps/docs/app/docs/troubleshooting) - Debug and bug reports
- [Stability](apps/docs/app/docs/stability) - Versioning and roadmap

Run locally:

```bash
npm run docs:dev     # http://localhost:3001
npm run docs:build   # Static export
```

## 🤝 Contributing

We actively welcome community contributions! Please review our [Contribution Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) to learn how to:

- Set up your local development environment
- Run the test suite
- Submit Pull Requests
- Follow our coding standards
- Where to add [examples](examples/), [presets](presets/), and [plugins](plugins/)

## 💬 Feedback & Discussions

- **Found a bug?** Submit a [Bug Report](https://github.com/reach/reach/issues/new?template=bug_report.yml).
- **Have an idea?** Submit a [Feature Request](https://github.com/reach/reach/issues/new?template=feature_request.yml).
- **Need help?** Start a thread in our [GitHub Discussions](https://github.com/reach/reach/discussions).

## 🗺️ Stability & Roadmap Transparency

Reach is currently in **Beta (0.3.x)**.

- **Core Engine**: The Rust deterministic evaluate loop is stable.
- **APIs**: Minor structural changes may occur prior to 1.0.
- **Backwards Compatibility**: State migrations are provided for all breaking changes.

View our public roadmap and upcoming milestones in the [GitHub Projects Board](../../projects).

---

## 📝 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
