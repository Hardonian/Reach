# Issue Triage Playbook

Guidelines for maintainers and contributors helping to categorize and respond to issues.

---

## Label Taxonomy

### Type Labels

| Label | Use When | Example |
|-------|----------|---------|
| `bug` | Unexpected behavior violating spec | Replay divergence, export failure |
| `feature` | New capability request | New CLI flag, plugin hook |
| `docs` | Documentation improvement | Missing examples, unclear guides |
| `performance` | Speed or resource optimization | Slow replay, memory growth |
| `security` | Vulnerability or hardening | Policy bypass, injection risk |

### Severity Labels

| Label | Definition | Response Target |
|-------|------------|-----------------|
| `severity:critical` | Data loss, security breach, complete unusability | 24 hours |
| `severity:high` | Core functionality broken, no workaround | 72 hours |
| `severity:medium` | Feature impaired, workaround exists | 1 week |
| `severity:low` | Cosmetic, edge case, documentation | Next release |

### Status Labels

| Label | Meaning | Next Action |
|-------|---------|-------------|
| `needs-triage` | New issue, awaiting review | Triage within 48 hours |
| `needs-info` | Awaiting reporter clarification | Request specific diagnostics |
| `accepted` | Approved for implementation | Await PR or assign developer |
| `declined` | Not aligned with project goals | Explain why, close politely |
| `duplicate` | Same issue exists | Link to original, close |
| `help-wanted` | Community contributions welcome | Apply to good entry points |
| `good first issue` | Suitable for newcomers | Clear description, mentor assigned |

### Component Labels

| Label | Scope |
|-------|-------|
| `component:cli` | Command-line interface |
| `component:engine` | Rust deterministic evaluation core |
| `component:runner` | Go execution runner |
| `component:policy` | Policy engine and rego rules |
| `component:storage` | Data persistence and replay |
| `component:docs` | Documentation and examples |

---

## Triage Workflow

### Step 1: Initial Review (within 48 hours)

For every new issue:

1. **Read completely** - Understand the problem
2. **Apply type label** - bug/feature/docs/performance/security
3. **Apply component label** - Where does this live?
4. **Check for duplicates** - Search related issues
5. **Request diagnostics if missing** - `./reach doctor`, `./reach report demo`

### Step 2: Severity Assessment

Ask these questions:

1. Is data at risk? → `severity:critical`
2. Is there a workaround? → No = `severity:high`, Yes = `severity:medium`
3. Is this cosmetic/docs? → `severity:low`

### Step 3: Routing

| Issue Type | Destination |
|------------|-------------|
| Critical security | Private security@ channel + public tracking issue |
| Critical/High bug | Core maintainer Slack + assign immediately |
| Feature request | Weekly triage meeting agenda |
| Docs/examples | Any maintainer can approve |
| Good first issue | Mark and advertise in discussions |

---

## Response Standards

### Initial Response Templates

**Bug (sufficient info):**
```
Thanks for the detailed report. I can reproduce this.

Labels: bug, severity:high, component:engine
Assigned: @maintainer
Target: v0.3.2
```

**Bug (needs info):**
```
Thanks for reporting. To help us reproduce this, could you provide:

1. Output of `./reach doctor`
2. Generated `./reach report demo` manifest
3. Minimal pack that triggers the issue

Labels: bug, needs-info
```

**Feature request:**
```
Thanks for the suggestion. This aligns with [goal].

We'll evaluate this in our next triage meeting (Wednesdays).
Labels: feature, needs-triage
```

**Declined (with reason):**
```
Thanks for the proposal. After review, we're declining this because [reason].

This doesn't mean the problem isn't valid—[alternative approach] might achieve your goal.
Closing, but happy to discuss further in discussions.
```

### Time-to-Response Targets

| Severity | First Response | Status Update | Resolution |
|----------|----------------|---------------|------------|
| Critical | 4 hours | 12 hours | 24 hours |
| High | 24 hours | 3 days | 1 week |
| Medium | 48 hours | Weekly | Next minor release |
| Low | 1 week | Monthly | Next major release |

---

## Triage Meeting Agenda (Weekly)

Review issues labeled:
- `needs-triage` > 7 days old
- `feature` without response
- `help-wanted` without assignee

Decisions to make:
1. Accept/decline pending features
2. Reassign stuck issues
3. Update severity if impact changed
4. Identify `good first issue` candidates

---

## Special Cases

### Security Reports

1. Immediately notify security@ mailing list
2. Create private tracking issue
3. Coordinate fix and disclosure timeline
4. Credit reporter in security advisory

### Duplicate Detection

Before marking duplicate:
1. Verify root cause is identical
2. Cross-link both issues
3. Keep the issue with better reproduction steps
4. Copy any unique context to the kept issue

### Stale Issues

Issues inactive for 30 days:
1. Add `stale` label
2. Comment: "Is this still relevant?"
3. Close after 14 days if no response

---

## Metrics

Track monthly:
- Time to first response (by severity)
- Issues opened/closed ratio
- `good first issue` resolution rate
- Community contributor PRs merged

---

## Related Resources

- [Bug Reporting Guide](./bug-reporting.md) - Reporter expectations
- [Feature Request Guide](./feature-requests.md) - Proposal standards
- [PR Guidelines](./pr-guidelines.md) - Submission requirements
- [GitHub Labels](../internal/GITHUB_LABELS.md) - Label definitions
