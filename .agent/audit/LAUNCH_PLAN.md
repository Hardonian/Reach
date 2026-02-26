# Reach Launch-Ready Execution Plan

## Executive Summary

- **P0 Items**: 14 total (11 complete, 3 in progress)
- **Estimated Launch Readiness**: 1 week (with focused effort on P0 gaps)
- **Biggest Risk**: Missing cloud authentication commands
- **Biggest Opportunity**: Complete CLI documentation

---

## Stage 1: P0 - Must Ship for Announcement

### Week 1 Focus

#### Day 1-2: Critical Honesty Patches
| Task | File | Effort | Owner |
|------|------|--------|-------|
| Fix enterprise features claim | README.md | 30 min | Docs |
| Adjust homepage copy | page.tsx | 30 min | Marketing |
| Add CLI disclaimer | cli.md | 15 min | Docs |

**Acceptance Criteria**:
- [ ] No unimplemented features claimed as available
- [ ] Homepage accurately reflects setup requirements

---

#### Day 2-3: Cloud Authentication (Critical Gap)
| Task | Command | Effort | Owner |
|------|---------|--------|-------|
| Implement login | `reach login` | 1 day | Backend |
| Implement logout | `reach logout` | 2 hrs | Backend |
| Implement org switch | `reach org` | 4 hrs | Backend |
| Add auth to wrapper | `reach` bash script | 2 hrs | CLI |

**Implementation Spec**:
```go
// reachctl login command
func runLogin(ctx context.Context, args []string, out io.Writer) int {
    // 1. Check for existing token
    // 2. If none, open browser to auth.reach.dev
    // 3. Poll for token callback
    // 4. Store in ~/.reach/credentials (chmod 600)
    // 5. Test with /api/v1/auth/me
}
```

**Acceptance Criteria**:
- [ ] `reach login` opens browser for OAuth
- [ ] Token stored securely in ~/.reach/
- [ ] `reach logout` clears credentials
- [ ] `reach org list` shows organizations

---

#### Day 3-5: CLI Documentation Expansion
| Task | Pages | Effort | Owner |
|------|-------|--------|-------|
| Document all 40+ commands | cli.md | 2 days | Docs |
| Create command quick reference | cli-quickref.md | 4 hrs | Docs |
| Add examples for each command | cli.md | 4 hrs | DevRel |

**Acceptance Criteria**:
- [ ] Every CLI command has documentation
- [ ] Every command has at least one example
- [ ] Exit codes documented

---

#### Day 4-5: CI/CD Integration Guide
| Task | Deliverable | Effort | Owner |
|------|-------------|--------|-------|
| GitHub Actions guide | docs/ci-cd.md | 4 hrs | DevRel |
| GitLab CI example | docs/ci-cd.md | 2 hrs | DevRel |
| Pre-commit hook example | docs/ci-cd.md | 2 hrs | DevRel |

**Acceptance Criteria**:
- [ ] GitHub Actions workflow example works
- [ ] GitLab CI example validated
- [ ] Copy-paste ready YAML blocks

---

### P0 Verification Checklist

```bash
# Run these before launch
npm run verify:cli        # All CLI commands documented
npm run verify:routes     # All routes accessible
npm run verify:conformance # API conformance
reach doctor              # Local environment healthy
reach demo                # One-command demo works
reach login --help        # Auth commands exist
```

---

## Stage 2: P1 - Next 2 Weeks Post-Launch

### Week 2-3: Enhanced Documentation

| Task | Deliverable | Effort | Dependencies |
|------|-------------|--------|--------------|
| How It Works page | /how-it-works | 3 days | Design |
| OSS vs Enterprise | /oss-vs-enterprise | 2 days | Marketing |
| Gates deep-dive | /docs/gates | 3 days | Product |
| Troubleshooting expansion | /docs/troubleshooting | 2 days | Support |

---

### Week 3: Cloud Command Suite

| Task | Command | Effort |
|------|---------|--------|
| API key management | `reach api-key` | 1 day |
| Artifact sync | `reach artifacts sync` | 1 day |
| Cloud status | `reach cloud status` | 4 hrs |
| Webhook management | `reach webhook` | 1 day |

---

### Week 4: Eval & Testing Commands

| Task | Command | Effort |
|------|---------|--------|
| Eval runner | `reach eval run` | 2 days |
| Eval comparison | `reach eval compare` | 1 day |
| Regression test | `reach eval regression` | 1 day |

---

## Dependencies & Risks

### Critical Path
```
reach login ─┬─> reach org ─┬─> Cloud features usable
             │              └─> Team governance
             └─> Token storage ─┬─> Security audit
                                └─> CI/CD integration
```

### Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Auth service not ready | HIGH | Implement offline mode for local-only usage |
| CLI docs incomplete | MEDIUM | Ship with `reach --help` as primary reference |
| Cloud commands missing | HIGH | Defer cloud launch by 1 week, focus on OSS |

---

## Success Metrics

### Launch Week Targets
- [ ] 100% of P0 commands implemented
- [ ] 0 theatre items (no misleading claims)
- [ ] `reach doctor` passes on fresh install
- [ ] `reach demo` completes in < 30 seconds
- [ ] All docs pages accessible

### 30-Day Targets
- [ ] 80% of P1 commands implemented
- [ ] CI/CD integration guide > 100 views
- [ ] Zero critical bugs in authentication
- [ ] 5+ external contributors successful

---

## Resource Allocation

| Role | Stage 1 Hours | Stage 2 Hours |
|------|---------------|---------------|
| Backend (Go) | 24 | 32 |
| Frontend (Next.js) | 8 | 16 |
| Documentation | 24 | 24 |
| DevRel/Examples | 8 | 16 |
| QA/Testing | 8 | 12 |

---

## Final Launch Checklist

### Pre-Launch (Day -1)
- [ ] All honesty patches applied
- [ ] `reach doctor` passes in clean environment
- [ ] `reach login` works end-to-end
- [ ] `reach demo` produces deterministic output
- [ ] Documentation site builds without errors
- [ ] All P0 pages render correctly
- [ ] Pricing page accurate
- [ ] Security page complete

### Launch Day
- [ ] Homepage live
- [ ] Docs site indexed
- [ ] GitHub release published
- [ ] npm package published
- [ ] Social announcement ready

### Post-Launch (Day +7)
- [ ] Bug reports triaged
- [ ] First external contribution merged
- [ ] Usage metrics reviewed
- [ ] Stage 2 planning finalized
