# Reach Repository Gap List
Generated: 2026-02-19
Status: IN PROGRESS

## ✅ COMPLETED

### Build / Lint / Typecheck / Tests
- [x] Fixed storage.go duplicate type declarations (massive duplication removal)
- [x] Fixed storage.go Close() nil pointer dereference (added nil checks)
- [x] Fixed storage.go fmt.Sprintf type mismatch (placeholder query fix)
- [x] Added pack-devkit/harness/go.mod for proper module resolution
- [x] Added harness dependency to services/runner/go.mod with replace directive
- [x] Fixed pack/score.go unused import (encoding/json)
- [x] Added missing runPackScore, runPackDocs, runPackValidate functions to reachctl
- [x] All Go tests passing

### Runtime Error Handling
- [x] SQLite prepared statements nil-safety in Close()

## 🔴 CRITICAL (Must Fix)

### Missing Test Coverage
- [ ] storage package has no test files (data layer untested)
- [ ] pack package has no test files
- [ ] adaptive package has no test files
- [ ] engineclient package has no test files
- [ ] spec package has no test files
- [ ] plugins package has no test files
- [ ] performance package has no test files

### Security
- [ ] No secret scanning in CI for new patterns
- [ ] .env.example needs more validation examples
- [ ] No rate limiting visible in API layer

### Documentation
- [ ] No ARCHITECTURE.md with module boundaries
- [ ] CONTRIBUTING.md is minimal
- [ ] No troubleshooting guide in README

## 🟡 IMPORTANT (Should Fix)

### Missing Observability
- [ ] No structured logging with correlation IDs
- [ ] No execution/session ID flowing through tasks
- [ ] No metrics endpoint

### Missing Developer Experience
- [ ] `reach doctor` command exists but could validate more
- [ ] No healthcheck endpoint in reach-serve
- [ ] No Dockerfile / docker-compose for dev

### Code Quality
- [ ] No error code documentation beyond ERROR_CODES.md
- [ ] Some packages have circular concerns (check dependencies)

## 🟢 NICE TO HAVE

### Polish
- [ ] TypeScript SDK tests
- [ ] Integration tests for CLI → runtime flow
- [ ] Smoke test script could be more comprehensive
- [ ] Mobile guide completeness check

## Verification Commands

```bash
# Fast verification (lint + typecheck)
npm run verify:fast

# Full verification (includes tests and build)
npm run verify:full

# Go-only verification
cd services/runner && go vet ./... && go test ./...

# Security check
npm run security:check
```

## Files Changed in This Pass

1. `pack-devkit/harness/go.mod` - NEW: Module definition
2. `services/runner/go.mod` - MODIFIED: Added harness replace directive
3. `services/runner/internal/storage/storage.go` - MAJOR: Removed ~400 lines of duplicate code, fixed nil pointer issues
4. `services/runner/internal/pack/score.go` - Removed unused import
5. `services/runner/cmd/reachctl/main.go` - Added pack subcommands
