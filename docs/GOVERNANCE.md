# Governance

## Maintainers

Reach is maintained by core repository maintainers responsible for roadmap,
release gating, and security response coordination.

## Decision Process

- Design changes should start with a spec or issue.
- Breaking changes require explicit migration notes.
- Security-sensitive changes require maintainer review.
- Economics config changes (model pricing, compute costs) require sign-off from both engineering and business leads.

## Release Authority

Maintainers control release tags and publication workflows after all required
checks and release gates pass.

## Economics & Pricing Governance

Changes to `config/economics.json` are production-critical and affect billing accuracy:

1. **Model pricing updates** require verification against provider invoices.
2. **New model additions** must include both `input_1k` and `output_1k` rates with source documentation.
3. **Compute cost changes** must reference the underlying cloud provider pricing page.
4. **Plan tier changes** (`tools/economics/src/types.ts` `PLAN_TIERS`) require business review before merge.

## Marketplace Pack Publishing

- All packs undergo automated security checks before publishing.
- Packs using high-risk tools (`shell.exec`, `fs.write`, `network.raw`, `process.spawn`, `crypto.key`) require manual security review.
- Flagged packs are blocked from installation until review is completed.
- Pack manifests are cryptographically signed; signature verification is required for installation.

## Trust Layer

- Trust scores use confidence blending: nodes with fewer than 20 delegations are scored conservatively toward a neutral prior.
- Circuit breaker thresholds (50% failure rate) trigger automatic quarantine with 30-second cooldown.
- Execution receipts use canonical JSON and HMAC-SHA256 for tamper-evident audit trails.

## CI Gates

The following gates must pass before merge to `main`:

| Gate | Scope |
|------|-------|
| `hygiene` | Lint, type-check, env validation |
| `language-enforcement` | Canonical terminology validation |
| `protocol` | Protocol schema and compatibility |
| `spec-conformance` | Spec version consistency |
| `rust` | Format, clippy, engine-core tests |
| `go` | Vet + test for runner service |
| `security-gates` | Dependency audit, secret scanning, security tests |
| `hardening-gates` | Release gates, queue regression, trust layer, economics config |
| `perf-gate` | Latency thresholds (trigger p95 < 1.6s, approval p95 < 1.3s) |
