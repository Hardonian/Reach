# Required Static Pages - Build Spec

## P0: Must Ship for Announcement

### 1. Homepage (/)
**Status**: EXISTS ✅  
**File**: `apps/arcade/src/app/page.tsx`  
**Audience**: All personas  
**Sections Required**:
- Hero with video fallback
- Live demo (inline)
- OSS install instructions
- How it works (3 steps)
- Social proof/endorsements (placeholder ok)
- CTA to docs

**Cross-links**: /docs, /playground, /pricing, /enterprise

---

### 2. Documentation Hub (/docs)
**Status**: EXISTS ✅  
**File**: `apps/arcade/src/app/docs/page.tsx`  
**Audience**: Platform Engineer, ML Engineer  
**Sections Required**:
- Navigation pack (top 10 entry points)
- Core concept map
- Path selector (OSS Core vs Enterprise)
- Specifications index
- Whitepapers index

**Cross-links**: All doc pages, CLI reference, API reference

---

### 3. CLI Reference (/docs/cli)
**Status**: EXISTS ⚠️ (needs expansion)  
**File**: `docs/cli.md` (renders to /docs/cli)  
**Audience**: Platform Engineer  
**Sections Required**:
- Command matrix table
- Core commands with examples
- Exit codes reference
- JSON mode documentation
- Environment variables

**Missing Content**:
- [ ] Complete command list (40+ commands, only 9 documented)
- [ ] Subcommand documentation for `reach gate`, `reach eval`
- [ ] Flag reference for all commands

**Cross-links**: /docs/install, /docs/getting-started

---

### 4. Installation Guide (/docs/install)
**Status**: EXISTS ✅  
**File**: `docs/INSTALL.md`  
**Audience**: Platform Engineer  
**Sections Required**:
- Prerequisites
- Package manager installs (npm, brew, apt, etc.)
- Source build instructions
- Docker instructions
- Verification steps

**Cross-links**: /docs/quickstart, /docs/cli

---

### 5. Quick Start (/docs/getting-started)
**Status**: EXISTS ✅  
**Files**: `docs/getting-started/10-minute-success.md`, `docs/QUICKSTART_TECH.md`  
**Audience**: All personas  
**Sections Required**:
- 60-second proof
- 10-minute success path
- CLI-only path
- Web-only path
- Mixed path

**Cross-links**: /playground, /docs/install

---

### 6. Playground (/playground)
**Status**: EXISTS ✅  
**File**: `apps/arcade/src/app/playground/page.tsx`  
**Audience**: All personas  
**Sections Required**:
- Live demo environment
- Pre-configured examples
- Output visualization

**Cross-links**: /docs, /templates

---

### 7. Pricing (/pricing)
**Status**: EXISTS ✅  
**File**: `apps/arcade/src/app/pricing/page.tsx`  
**Audience**: CTO, Engineering Manager  
**Sections Required**:
- OSS tier (free, unlimited local runs)
- Pro/Team tier
- Enterprise tier
- Feature comparison matrix

**Cross-links**: /enterprise, /docs

---

### 8. Enterprise (/enterprise)
**Status**: EXISTS ✅  
**File**: `apps/arcade/src/app/enterprise/page.tsx`  
**Audience**: CTO, Security Officer  
**Sections Required**:
- Governance features
- Security & compliance
- Support SLA
- Contact sales form

**Cross-links**: /pricing, /security

---

### 9. Security (/security)
**Status**: EXISTS ✅  
**File**: `apps/arcade/src/app/security/page.tsx`  
**Audience**: Security Officer  
**Sections Required**:
- Security posture
- Compliance certifications
- Responsible disclosure
- Audit reports (placeholder)

**Cross-links**: /legal/privacy, /responsible-disclosure

---

### 10. Determinism Spec (/specs/determinism-v1.0)
**Status**: EXISTS ✅  
**File**: `docs/specs/determinism-v1.0.md`  
**Audience**: ML Engineer, Platform Engineer  
**Sections Required**:
- Fingerprinting algorithm
- Canonical JSON encoding
- Cross-language guarantees
- Golden vector test cases

**Cross-links**: /docs, /whitepapers/deterministic-governance

---

## P1: Next 2 Weeks

### 11. How It Works (/how-it-works)
**Status**: MISSING ❌  
**File**: Create `apps/arcade/src/app/how-it-works/page.tsx`  
**Audience**: All personas  
**Sections Required**:
1. **The Problem**: Decision entropy in AI systems
2. **The Solution**: Deterministic execution fabric
3. **The Flow**: 
   - Input canonicalization
   - Policy gate evaluation
   - Execution with proof generation
   - Capsule output
4. **The Verification**: Replay and audit

**Data Dependencies**: None (static content)  
**Diagrams Needed**: 
- [ ] Architecture diagram (Mermaid)
- [ ] Execution flow diagram
- [ ] Verification flow diagram

**Cross-links**: /docs, /specs/determinism-v1.0

---

### 12. OSS vs Enterprise Comparison (/oss-vs-enterprise)
**Status**: MISSING ❌  
**File**: Create `apps/arcade/src/app/oss-vs-enterprise/page.tsx`  
**Audience**: CTO, Engineering Manager  
**Sections Required**:
- Feature comparison matrix
- When to use OSS (local dev, individual)
- When to upgrade (team, compliance, CI gates)
- Migration path
- Self-hosted vs Cloud options

**Data Dependencies**: Feature flags from config  
**Cross-links**: /pricing, /enterprise, /docs

---

### 13. CI/CD Integration Guide (/docs/ci-cd)
**Status**: MISSING ❌  
**File**: Create `docs/ci-cd.md`  
**Audience**: Platform Engineer  
**Sections Required**:
- GitHub Actions integration
- GitLab CI integration
- Jenkins integration
- CircleCI integration
- Azure DevOps integration
- Pre-commit hooks

**Example Configurations**:
```yaml
# GitHub Actions example
- name: Reach Determinism Check
  run: |
    reach doctor
    reach verify-determinism
```

**Cross-links**: /docs/cli, /docs/gates

---

### 14. Gates Documentation (/docs/gates)
**Status**: PARTIAL ⚠️  
**File**: `docs/POLICY_GATE.md`  
**Audience**: Platform Engineer, Security Officer  
**Sections Required**:
- What are gates
- Gate types (integrity, policy, drift)
- Creating gates
- Gate enforcement modes (warn, block)
- Gate reports
- Gate dashboard

**Missing**:
- [ ] `reach gate` command reference
- [ ] Gate YAML/JSON schema
- [ ] Troubleshooting gates

**Cross-links**: /docs/ci-cd, /console/governance

---

### 15. Troubleshooting (/docs/troubleshooting)
**Status**: EXISTS ⚠️ (needs expansion)  
**File**: `docs/troubleshooting.md`  
**Audience**: All personas  
**Sections Required**:
- Common failures
- Error code reference
- Debug mode
- Getting support
- FAQ

**Missing**:
- [ ] Error code search/index
- [ ] Interactive diagnostic flow
- [ ] Video tutorials

**Cross-links**: /support, /docs/cli

---

## Summary Table

| Page | Priority | Status | Effort | Owner |
|------|----------|--------|--------|-------|
| Homepage | P0 | EXISTS | - | - |
| Docs Hub | P0 | EXISTS | - | - |
| CLI Reference | P0 | PARTIAL | M | Docs |
| Install Guide | P0 | EXISTS | - | - |
| Quick Start | P0 | EXISTS | - | - |
| Playground | P0 | EXISTS | - | - |
| Pricing | P0 | EXISTS | - | - |
| Enterprise | P0 | EXISTS | - | - |
| Security | P0 | EXISTS | - | - |
| Determinism Spec | P0 | EXISTS | - | - |
| How It Works | P1 | MISSING | M | Marketing |
| OSS vs Enterprise | P1 | MISSING | S | Marketing |
| CI/CD Guide | P1 | MISSING | L | DevRel |
| Gates Docs | P1 | PARTIAL | M | Docs |
| Troubleshooting | P1 | PARTIAL | M | Support |

**Effort Scale**: S (1-2 days), M (3-5 days), L (1-2 weeks)
