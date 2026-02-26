# Honesty Patch - Truth-Preserving Copy Changes

## Issue Summary

Several claims in the codebase promise features that are not yet implemented. These should be marked as "coming soon" or removed to avoid deceptive marketing.

---

## Critical Fixes Required

### 1. README.md - Enterprise Features

**Location**: `README.md`, line 82  
**Current**:

```markdown
**Note**: This is the open-source core. Enterprise features (cloud-hosted runners, advanced analytics, team governance) are available in [Reach Cloud](https://reach.dev).
```

**Problem**: "cloud-hosted runners", "advanced analytics", "team governance" are mentioned but not implemented.

**Recommended**:

```markdown
**Note**: This is the open-source core. Enterprise cloud features (SaaS hosting, team collaboration, audit dashboards) are available in [Reach Cloud](https://reach.dev). See our [roadmap](ROADMAP.md) for upcoming features.
```

**Severity**: HIGH - Could be considered deceptive marketing

---

### 2. ADOPTION_PLAYBOOK.md - Gate Connect Command

**Location**: `docs/internal/ADOPTION_PLAYBOOK.md`, line 13  
**Current**:

```markdown
- **Action:** Links to `reach gate connect` instructions.
```

**Problem**: `reach gate connect` command does not exist.

**Recommended**:

```markdown
- **Action:** Links to GitHub integration setup documentation. (CLI command coming in v0.4)
```

**Severity**: MEDIUM - Internal doc, but misleading for implementation

---

### 3. Homepage - "No configuration required"

**Location**: `apps/arcade/src/app/page.tsx`, line 89  
**Current**:

```typescript
<p className="text-base text-emerald-400 font-medium mb-8">
  Your first policy gate is 30 seconds away. No configuration required.
</p>
```

**Problem**: Creating policy gates DOES require configuration (YAML/JSON files).

**Recommended**:

```typescript
<p className="text-base text-emerald-400 font-medium mb-8">
  Your first deterministic run is 30 seconds away. Zero setup required.
</p>
```

**Severity**: MEDIUM - "policy gate" is more complex than implied

---

### 4. CLI Reference - Command Completeness

**Location**: `docs/cli.md`  
**Current**: Documents 9 commands  
**Problem**: reachctl has 40+ commands, only 9 are documented.

**Recommended**: Add disclaimer at top:

```markdown
# Reach CLI Reference

**Note**: This documentation covers the most common commands.
For a complete list, run `reach --help`.
```

**Severity**: LOW - Documentation incompleteness is common

---

### 5. Page.tsx - "Upgrade to ReadyLayer"

**Location**: `apps/arcade/src/app/page.tsx`, line 85  
**Current**:

```typescript
upgrade to the ReadyLayer cloud for enterprise-grade governance
```

**Problem**: "ReadyLayer" branding is inconsistent (sometimes "Reach Cloud", "ReadyLayer", "Cloud").

**Recommended**: Standardize on one brand name:

```typescript
upgrade to Reach Cloud for enterprise-grade governance
```

**Severity**: LOW - Branding inconsistency

---

## Minor Fixes (Polish)

### 6. DETERMINISM_ROADMAP.md - Future Improvements

**Location**: Line 243  
**Current**: Lists 7 future improvements  
**Recommendation**: Add timeline expectations or move to GitHub issues

---

### 7. Quick Start Guide - Docker Example

**Location**: `docs/QUICKSTART_TECH.md`, line 142  
**Current**:

```yaml
docker run -d --name reach -p 8787:8787 reach/reach:latest
```

**Problem**: Docker image may not be published yet.

**Recommended**: Add note:

```markdown
# Docker image coming soon. Build from source:

docker build -t reach/reach:latest .
```

---

## Summary Table

| File                 | Line | Issue                             | Severity | Fix Type               |
| -------------------- | ---- | --------------------------------- | -------- | ---------------------- |
| README.md            | 82   | Unimplemented enterprise features | HIGH     | Remove specific claims |
| ADOPTION_PLAYBOOK.md | 13   | Non-existent command              | MEDIUM   | Update to reality      |
| page.tsx             | 89   | Overstated simplicity             | MEDIUM   | Adjust claim           |
| cli.md               | -    | Incomplete docs                   | LOW      | Add disclaimer         |
| page.tsx             | 85   | Brand inconsistency               | LOW      | Standardize            |

---

## Implementation Priority

1. **P0**: Fix README.md enterprise features claim before public release
2. **P1**: Fix ADOPTION_PLAYBOOK.md internal consistency
3. **P1**: Adjust homepage copy for accuracy
4. **P2**: Add CLI documentation disclaimer
5. **P2**: Standardize branding
