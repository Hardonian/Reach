# Reach Platform Promises - Source of Truth

## Promise Inventory by Domain

### 1. Determinism & Replay

| Promise | Source | Domain Tag |
|---------|--------|------------|
| "Reach provides deterministic execution guarantees for AI-driven workflows" | README.md#L3 | determinism-core |
| "Verifiable: Cryptographic proof of what executed and when" | README.md#L9 | determinism-proof |
| "Replayable: Identical inputs produce identical outputs, always" | README.md#L10 | determinism-replay |
| "Reach uses canonical fingerprinting across all execution boundaries" | README.md#L38 | determinism-fingerprint |
| "Every input, state transition, and output is deterministically hashed" | README.md#L38 | determinism-hashing |
| "Cross-language determinism: TypeScript and Rust produce identical fingerprints" | DETERMINISM_ROADMAP.md#L35 | determinism-crosslang |
| "12 golden test vectors covering various data types" | DETERMINISM_ROADMAP.md#L20 | determinism-golden-vectors |
| "WASM bridge for Rust-based determinism engine" | DETERMINISM_ROADMAP.md#L40 | determinism-wasm |
| "Deterministic Governance: framework ensuring every intent, policy, and state transition is cryptographically bound" | docs/whitepapers/deterministic-governance.md#L5 | determinism-governance |

### 2. Governance Gates / CI Integration

| Promise | Source | Domain Tag |
|---------|--------|------------|
| "Deterministic CI gates" | apps/arcade/src/app/page.tsx#L42 | ci-gates |
| "Enforce agent compliance. In your CI." | apps/arcade/src/app/page.tsx#L79 | ci-enforcement |
| "Model-agnostic CI gate integration" | apps/arcade/src/app/page.tsx#L32 | ci-model-agnostic |
| "Enable Release Gates for your repo" | docs/internal/ADOPTION_PLAYBOOK.md#L11 | ci-release-gates |
| "PR Gates to stop regressions before they hit production" | docs/internal/ADOPTION_PLAYBOOK.md#L18 | ci-pr-gates |
| "reach gate connect instructions" | docs/internal/ADOPTION_PLAYBOOK.md#L13 | ci-gate-connect |

### 3. Local-First Workflows

| Promise | Source | Domain Tag |
|---------|--------|------------|
| "Reach works in OSS mode by default. Start local, then promote to enforced CI gates" | apps/arcade/src/app/page.tsx#L128 | local-oss-first |
| "Use the open-source Reach CLI for deterministic local runs" | apps/arcade/src/app/page.tsx#L84 | local-cli |
| "curl -sSL install.sh \| bash" | README.md#L17 | local-install |
| "No account. No setup. Just click." | apps/arcade/src/app/page.tsx#L117 | local-zero-config |
| "Your first policy gate is 30 seconds away. No configuration required" | apps/arcade/src/app/page.tsx#L89 | local-quickstart |
| "One-command demo: reach demo" | README.md#L26 | local-demo |

### 4. Cloud Control Plane (Enterprise)

| Promise | Source | Domain Tag |
|---------|--------|------------|
| "Upgrade to the ReadyLayer cloud for enterprise-grade governance" | apps/arcade/src/app/page.tsx#L85 | cloud-readylayer |
| "Enterprise features (cloud-hosted runners, advanced analytics, team governance)" | README.md#L82 | cloud-enterprise |
| "Reach Cloud at https://reach.dev" | README.md#L82 | cloud-url |
| "cloud-hosted runners" | README.md#L82 | cloud-runners |
| "advanced analytics" | README.md#L82 | cloud-analytics |
| "team governance" | README.md#L82 | cloud-team-governance |

### 5. Artifact / Capsule / Provenance

| Promise | Source | Domain Tag |
|---------|--------|------------|
| "Auditable: Complete chain of custody for every execution" | README.md#L11 | artifacts-audit |
| "capsule create <run-id>: Export a run to a portable JSON capsule" | docs/cli.md#L59 | artifacts-capsule |
| "capsule verify <file>: Cryptographically verify a capsule's integrity" | docs/cli.md#L60 | artifacts-verify |
| "capsule replay <file>: Perform a bit-perfect replay of the capsule" | docs/cli.md#L61 | artifacts-replay |
| "Export a run to a portable JSON capsule" | services/runner/cmd/reachctl/main.go#L397 | artifacts-portable |

### 6. Integrations

| Promise | Source | Domain Tag |
|---------|--------|------------|
| "GitHub webhook integration" | apps/arcade/src/app/api/github/webhook/route.ts | integration-github |
| "Vercel integration" | docs/partners/vercel.md | integration-vercel |
| "Stripe billing integration" | apps/arcade/src/app/api/v1/billing/* | integration-stripe |
| "HuggingFace integration" | docs/partners/huggingface.md | integration-huggingface |

### 7. Security & Compliance

| Promise | Source | Domain Tag |
|---------|--------|------------|
| "SOC2 Control Mapping" | docs/compliance/determinism-soc2-mapping.md | compliance-soc2 |
| "Security posture documentation" | docs/security/security-posture.md | compliance-security |
| "Responsible disclosure" | apps/arcade/src/app/responsible-disclosure/page.tsx | compliance-disclosure |
| "RBAC support" | docs/rbac.md | compliance-rbac |

### 8. SDK & API

| Promise | Source | Domain Tag |
|---------|--------|------------|
| "TypeScript SDK: @reach/sdk" | docs/QUICKSTART_TECH.md#L50 | sdk-typescript |
| "Python SDK: reach-sdk" | docs/QUICKSTART_TECH.md#L75 | sdk-python |
| "OpenAPI specification" | openapi/reach.openapi.yaml | sdk-openapi |
| "cURL examples" | docs/QUICKSTART_TECH.md#L30 | sdk-curl |

---

## Summary Statistics

- **Total Promises Extracted**: 45
- **Determinism Domain**: 9 promises
- **CI/Governance Domain**: 6 promises
- **Local-First Domain**: 6 promises
- **Cloud/Enterprise Domain**: 6 promises
- **Artifacts Domain**: 5 promises
- **Integrations Domain**: 4 promises
- **Compliance Domain**: 4 promises
- **SDK/API Domain**: 4 promises
