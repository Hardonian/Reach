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
npm install

# 3. Verify your setup
./reach doctor
```

## 🧪 Running Tests

Reach requires absolute determinism. Ensure all tests pass before submitting your PR.

```bash
# Run the full validation suite (lint, typecheck, tests)
npm run verify:full

# Site split checks (claims, links, boundaries, canonical URLs)
npm run verify:sites

# Testing the Core Rust Engine
cd crates/engine && cargo test

# Testing the Go Runner
cd services/runner && go test ./...
```

## 🌐 Running the Demo

To test your changes against the visual evidence graph, you can run the local demo:

```bash
# Start the web interface
npm run dev --workspace arcade

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

## 💡 How to Propose an Idea

- **Bug Reports**: [File an issue](../../issues/new?template=bug_report.yml) with the `./reach report demo` output
- **Feature Requests**: [Submit a feature request](../../issues/new?template=feature_request.yml)
- **Questions**: Start a [GitHub Discussion](../../discussions)

## 🎯 Good First Issues

Look for issues labeled:

- `good first issue` - Great for newcomers
- `help wanted` - Community contributions welcome
- `documentation` - Docs improvements

## 📝 Where to Contribute

### Examples

Add examples to `examples/` following the numbered format:

- Each example should be runnable with `node examples/XX-name/run.js`
- Include a README explaining the concepts demonstrated

### Presets

Add presets to `presets/`:

- Create a directory under the appropriate category
- Include a README with usage instructions
- Add to `presets/map.json` if it's a new starting path

### Plugins

Add plugins to `plugins/`:

- Use `./reach plugins scaffold <name>` to get started
- Ensure deterministic behavior
- Include tests and documentation

### Packs

Add packs under `packs/` or `examples/packs/`:

- Validate pack shape: `reach pack lint <path>`
- Run pack doctor: `reach pack doctor <path>`
- If publishing metadata, use `reach pack publish <path> --dry-run` first

### Docs and Spec Updates

When command behavior or security posture changes, update:

- `README.md`
- `docs/cli.md` and `docs/INSTALL.md`
- `docs/threat-model.md` (if threat/mitigation changed)
- `spec/REACH_PROTOCOL_v1.md` (for protocol changes)

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
