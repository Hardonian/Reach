# Contributing to Reach

Welcome! Reach is built on principles of determinism, accountability, and clarity. We appreciate your help in making it better.

## ⚙️ Development Setup

The Reach environment requires Node.js, Go, Rust, and SQLite.

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/reach/reach.git
cd reach

# 2. Install dependencies
pnpm install

# 3. Verify your setup
./reachctl doctor
```

## 🧪 Running Tests

Reach requires absolute determinism. Ensure all tests pass before submitting your PR.

```bash
# Run the full validation suite (lint, typecheck, tests)
pnpm run verify:full

# Testing the Core Rust Engine
cd crates/engine && cargo test

# Testing the Go Runner
cd services/runner && go test ./...
```

## 🌐 Running the Demo

To test your changes against the visual evidence graph, you can run the local demo:

```bash
# Start the web interface
pnpm run demo

# Open your browser to http://localhost:3000
```

Alternatively, test core scenarios via CLI using the example scripts:

```bash
node examples/01-quickstart-local/run.js
```

## 🚀 PR Guidelines

To maintain our quality bar, all Pull Requests must adhere to the following rules:

1. **Zero Entropy**: No non-deterministic logic (e.g., `time.Now()` or randomness without a seed) in core paths.
2. **Minimal Diff**: Change only what is required to solve the problem. Avoid sweeping refactors in feature PRs.
3. **Pass CI**: Ensure the GitHub Actions CI pipeline is green.
4. **Description**: Clearly explain _what_ you changed and _why_. Use the provided PR template.

## 📝 Commit Expectations

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(scope): new feature`
- `fix(scope): bug fix`
- `docs(scope): documentation updates`
- `refactor(scope): code structure changes (no logic shifts)`
- `test(scope): test additions or modifications`

Example: `fix(engine): resolve race condition in junction evaluation`

---

Thank you for contributing to Reach!
