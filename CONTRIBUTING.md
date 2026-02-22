# Contributing to Reach

Last Updated: 2026-02-22

Thank you for your interest in contributing to Reach! This document provides comprehensive guidelines for contributing to the project.

## ⚠️ Deterministic CI Requirements (Read First)

Before opening any PR, all contributors must pass the OSS governance gate:

```bash
npm run verify:oss
```

This runs three required checks:
1. `validate:language` — No internal terms in UI-facing text
2. `validate:boundaries` — No cloud SDK imports in OSS Core paths
3. `validate:oss-purity` — Zero-cloud lock verified

Additionally, all PRs must pass the CI checks in [AGENTS.md](AGENTS.md). Specifically:
- Never introduce `time.Now()` or `rand.Int()` in fingerprint paths (causes determinism violations)
- Never iterate over Go maps without sorting keys first
- Any new execution feature must include a golden fixture in `testdata/fixtures/conformance/`
- Any new event type requires an update to `protocol/schemas/events.schema.json`

See [AGENTS.md](AGENTS.md) for the complete governance contract.

---

## Table of Contents - [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Review Process](#review-process)
- [Security](#security)
- [Release Process](#release-process)

## Code of Conduct This project adheres to a code of conduct. By participating, you are expected to uphold this code:

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Started ### Prerequisites

- **Go** 1.23+ (for backend services)
- **Rust** stable (see `rust-toolchain.toml` for engine)
- **Node.js** 18+ (for web apps and tooling)
- **SQLite** 3.35+ (database)
- **Git** 2.30+

### Quick Setup ```bash
# Clone the repository
git clone https://github.com/yourorg/reach.git
cd reach

# Install dependencies
npm install
(cd extensions/vscode && npm install)

# Verify setup
./reach doctor
```

## Development Setup ### Full Environment Setup

```bash
# Install Go dependencies
cd services/runner && go mod download && cd ../..

# Install Rust toolchain
cd crates/engine && cargo build --release && cd ../..

# Install Node.js dependencies
npm install

# Setup database (SQLite - no external DB needed)
mkdir -p data

# Run initial verification
npm run verify:full
```

### Docker Development (Recommended) ```bash
# Start development environment
docker-compose up -d runner

# View logs
docker-compose logs -f runner

# Run commands inside container
docker-compose exec runner go test ./...
```

### IDE Setup **VS Code** (recommended):
- Install recommended extensions (see `.vscode/extensions.json`)
- Use workspace settings for consistent formatting
- Install the Reach VS Code extension from `extensions/vscode/`

**GoLand/IntelliJ**:
- Enable Go modules support
- Set project GOPATH
- Enable gofmt/goimports on save

**Vim/Neovim**:
- Use `vim-go` or `coc-go`
- Enable LSP support

## Project Structure ```
Reach/
├── services/
│   └── runner/           # Main Go service
│       ├── internal/
│       │   ├── api/      # HTTP handlers
│       │   ├── storage/  # Database layer
│       │   ├── jobs/     # Job queue
│       │   └── ...       # Other internal packages
│       └── cmd/server/   # Entry point
├── crates/
│   ├── engine/           # Rust deterministic engine
│   └── engine-core/      # Core Rust library
├── sdk/
│   ├── ts/               # TypeScript SDK
│   └── python/           # Python SDK
├── mobile/
│   ├── android/          # Android SDK
│   └── ios/              # iOS SDK
├── apps/
│   └── arcade/           # Next.js web app
├── extensions/
│   └── vscode/           # VS Code extension
├── docs/                 # Documentation
├── tests/                # Integration tests
└── docker/               # Docker configurations
```

## Development Workflow ### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch (optional)
- `feat/<feature-name>` - New features
- `fix/<bug-description>` - Bug fixes
- `docs/<documentation>` - Documentation updates
- `refactor/<scope>` - Code refactoring

### Creating a Branch ```bash
# Sync with main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feat/my-feature

# Or create fix branch
git checkout -b fix/bug-description
```

### Commit Messages Follow conventional commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.

Examples:
```
feat(api): add rate limiting middleware

fix(storage): handle edge case in job leasing

docs(architecture): add module boundaries diagram

test(adaptive): add strategy selection tests
```

## Code Style ### Go

- Follow standard Go conventions
- Run `go fmt` before committing
- Run `go vet` to catch common issues
- Use `golangci-lint` for comprehensive checks

```bash
cd services/runner
go fmt ./...
go vet ./...
golangci-lint run
```

Key conventions:
- Package names are short and lowercase (`api`, `storage`)
- Exported names are capitalized
- Use meaningful variable names
- Keep functions focused and small
- Document exported functions

### Rust - Follow Rust API guidelines
- Run `cargo fmt` and `cargo clippy`
- Use `cargo check` for quick validation

```bash
cd crates/engine
cargo fmt
cargo clippy -- -D warnings
cargo check
```

### TypeScript/JavaScript - Use TypeScript strict mode
- Follow ESLint configuration
- Use Prettier for formatting

```bash
npm run lint
npm run typecheck
```

## Testing ### Running Tests

**All tests:**
```bash
npm run verify:full
```

**Go backend:**
```bash
cd services/runner
go test ./...
go test -race ./...
```

**Rust engine:**
```bash
cd crates/engine
cargo test
cargo test --release
```

**Specific package:**
```bash
cd services/runner
go test ./internal/storage -v
go test ./internal/api -run TestCreateRun
```

**With coverage:**
```bash
cd services/runner
go test -cover ./...
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Writing Tests **Go Tests:**
```go
func TestFeature(t *testing.T) {
    // Setup
    db := setupTestDB(t)
    defer db.Close()

    // Execute
    result, err := db.GetSomething(ctx, "id")

    // Assert
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if result != expected {
        t.Errorf("expected %v, got %v", expected, result)
    }
}

func BenchmarkFeature(b *testing.B) {
    db := setupTestDB(b)
    defer db.Close()

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        db.GetSomething(ctx, "id")
    }
}
```

**Test Utilities:**
- Use `t.TempDir()` for temporary directories
- Use `httptest` for HTTP testing
- Mock external dependencies
- Clean up resources with `defer`

### Integration Tests Located in `tests/integration/`:

```bash
# Run integration tests
cd tests/integration
go test -v ./...

# Run with real dependencies
go test -v -tags=integration ./...
```

### Load Tests ```bash
cd tests/load
k6 run scenario.js
```

## Documentation ### Code Documentation

- Document all exported functions, types, and packages
- Include examples for complex functions
- Document error conditions

```go
// Package storage provides database persistence for the runner service.
// It uses SQLite for single-node deployments with WAL mode for better concurrency.
package storage

// CreateRun creates a new run record in the database.
// Returns ErrNotFound if the run already exists with a different tenant.
func (s *SQLiteStore) CreateRun(ctx context.Context, rec RunRecord) error
```

### User Documentation - Update `docs/` for user-facing features
- Update `README.md` for setup/usage changes
- Update `CHANGELOG.md` for release notes

### Architecture Documentation - Update `ARCHITECTURE.md` for structural changes
- Update relevant ADRs in `docs/architecture/`

## Submitting Changes ### Before Submitting

1. **Run verification:**
```bash
npm run verify:full
```

2. **Check for lint errors:**
```bash
npm run lint
```

3. **Run tests:**
```bash
cd services/runner && go test ./...
```

4. **Update documentation:**
- Code comments
- User docs (if applicable)
- Changelog (for user-facing changes)

5. **Review your changes:**
```bash
git diff main
```

### Pull Request Template ```markdown
## Summary
Brief description of changes

## Problem
What problem does this solve?

## Solution
How does this solve the problem?

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing performed

## Risks
What could go wrong?

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Changelog updated (if applicable)
```

### Creating a Pull Request 1. Push your branch:
```bash
git push origin feat/my-feature
```

2. Create PR on GitHub:
- Use descriptive title
- Fill out PR template
- Link related issues
- Add appropriate labels

3. Request reviews from:
- Code owners for affected areas
- At least one senior maintainer

## Review Process ### As a Reviewer

- Review within 48 hours
- Be constructive and specific
- Approve only when satisfied
- Request changes for issues

### As an Author - Respond to all comments
- Make requested changes promptly
- Resolve conversations when fixed
- Re-request review when ready

### Review Criteria - **Correctness**: Does it work? Are edge cases handled?
- **Testing**: Are there adequate tests?
- **Documentation**: Is it documented?
- **Security**: Any security concerns?
- **Performance**: Any performance implications?
- **Style**: Does it follow conventions?

## Security ### Security Guidelines

- Never commit secrets, passwords, or API keys
- Use environment variables for configuration
- Validate all inputs
- Use parameterized queries (prevent SQL injection)
- Escape output (prevent XSS)
- Follow OWASP guidelines

### Reporting Security Issues - Email security@reach.io
- Do not open public issues for security bugs
- Include reproduction steps
- Allow 90 days before public disclosure

### Security Checklist - [ ] No hardcoded credentials
- [ ] Input validation
- [ ] Output encoding
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Secure defaults
- [ ] Audit logging for sensitive operations

## Release Process ### Versioning

We follow [Semantic Versioning](https://semver.org/):
- MAJOR: Incompatible API changes
- MINOR: Backward-compatible functionality
- PATCH: Backward-compatible bug fixes

### Preparing a Release 1. Update version:
```bash
# Update VERSION file
echo "1.2.3" > VERSION
```

2. Update changelog:
```bash
# Add release notes to CHANGELOG.md
```

3. Run release checks:
```bash
./reach release-check
```

4. Create release PR:
- Branch: `release/v1.2.3`
- Include all changes since last release
- Get approvals

### Creating a Release ```bash
# Tag the release
git tag -a v1.2.3 -m "Release version 1.2.3"
git push origin v1.2.3

# Or use GitHub releases
# Go to Releases → Draft a new release
```

### Post-Release - Monitor error rates
- Monitor performance metrics
- Be prepared to rollback

## Getting Help ### Resources

- [Documentation](docs/)
- [Architecture](ARCHITECTURE.md)
- [API Reference](docs/api/)
- [Troubleshooting](docs/troubleshooting.md)

### Communication - GitHub Issues: Bug reports, feature requests
- GitHub Discussions: Questions, ideas
- Slack: Real-time chat (invite-only)
- Email: reach@example.com

### Office Hours Join our weekly office hours:
- When: Thursdays 2pm UTC
- Where: Zoom link in calendar
- What: Ask questions, get help, discuss ideas

## Recognition Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Added to the organization (for significant contributions)

Thank you for contributing to Reach!
