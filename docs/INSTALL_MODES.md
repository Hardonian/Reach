# Reach Installation Modes This document describes the different installation modes available for Reach and their security implications.

## Installation Modes ### 1. Core Mode (Default) ⭐ RECOMMENDED

The safest installation mode with minimal dependencies and no native build requirements.

```bash
npm ci --omit=dev
```

**What's included:**

- Go services (runner, connector-registry, integration-hub, etc.)
- TypeScript SDK (built)
- VS Code extension runtime (ws for WebSocket support)

**Security features:**

- No toxic dependencies (clawdbot, codex, connect, request, marked)
- No native compilation required
- Minimal attack surface
- Fast installation

**Use cases:**

- Production deployments
- CI/CD pipelines
- Docker containers
- Environments with strict security requirements

### 2. Development Mode Full installation with all development dependencies for contributing to Reach.

```bash
npm ci
```

**What's included:**

- Everything in Core Mode
- TypeScript compiler
- ESLint and linting tools
- Vitest for testing
- Go test dependencies

**Security considerations:**

- Contains dev dependencies with known vulnerabilities (tracked in issue #XXX)
- Vulnerabilities are in tooling only, not runtime
- Acceptable for local development only

**Use cases:**

- Local development
- Running tests
- Building from source

## Blocked Packages The following packages are explicitly blocked from the Reach dependency tree via npm overrides:

| Package          | Reason                                    | Alternative                          |
| ---------------- | ----------------------------------------- | ------------------------------------ |
| `clawdbot`       | Malicious/untrusted                       | N/A                                  |
| `codex`          | Name collision with internal codex string | N/A                                  |
| `connect`        | Deprecated, vulnerable middleware         | Express native middleware            |
| `request`        | Deprecated, unmaintained                  | `fetch` API or `undici`              |
| `marked`         | XSS vulnerabilities in older versions     | Use with sanitization or alternative |
| `hono`           | Not used in Reach                         | N/A                                  |
| `node-llama-cpp` | Optional local LLM feature only           | See Optional Features                |

## Optional Features ### Local LLM Support (Advanced)

If you need local LLM support via `node-llama-cpp`, you must explicitly opt-in:

```bash
# Install core first
npm ci --omit=dev

# Then install optional LLM support
npm install --save-optional node-llama-cpp
```

**Requirements:**

- CMake
- C++ compiler toolchain
- Node.js native addon build environment
- ~2GB additional disk space

**Security considerations:**

- Requires native compilation
- Pulls in additional dependencies (cmake-js, tar, etc.)
- Not recommended for production deployments
- Use cloud-based LLM APIs instead when possible

## Verification ### Verify Production Install

```bash
npm run verify:prod-install
```

This script:

1. Installs with `--omit=dev`
2. Verifies no dev dependencies are present
3. Confirms SDK builds (or warns if TypeScript needed)
4. Verifies Go services compile

### Verify No Toxic Dependencies ```bash

npm run verify:no-toxic-deps

````

This script checks for:
- Blocked packages in dependency tree
- Vulnerable versions of restricted packages (tar, ws)
- Dev dependencies in production installs

### Security Audit ```bash
npm run security:audit
````

Runs `npm audit` on all workspaces and reports results.

## Node.js Version Requirements Reach supports Node.js versions:

- Minimum: 18.0.0
- Maximum: 22.x (23.x not yet supported)

The `preinstall` script will warn (or fail in CI) if your Node version is outside this range.

## CI Security Gates All pull requests are checked by:

1. **Dependency Firewall** - Blocks known malicious packages
2. **Toxic Dependency Check** - Scans for clawdbot, codex, etc.
3. **Production Install Verification** - Ensures clean prod install
4. **npm Audit** - Reports high/critical vulnerabilities

See `.github/workflows/security-audit.yml` for implementation details.

## Reporting Security Issues If you discover a security vulnerability in Reach:

1. **DO NOT** open a public issue
2. Email security@reach.io with details
3. Allow 72 hours for initial response
4. Follow responsible disclosure practices

## Related Documentation - [SECURITY.md](../SECURITY.md) - Security policy and reporting

- [AUDIT_REPORT.md](../AUDIT_REPORT.md) - Current audit status
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development setup
