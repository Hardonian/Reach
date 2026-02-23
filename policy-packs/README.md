# Reach Policy Packs

A collection of reusable policy packs for governing Reach executions.

## Quick Start (Copy-Paste)

```bash
# List all available policy packs
ls policy-packs/*.json

# View a specific pack
cat policy-packs/strict-safe-mode.json | head -20

# Use in a run (manual mode - copy pack path)
reach run my-pack.json --policies policy-packs/strict-safe-mode.json
```

## Available Policy Packs (8 Total)

### Safety Policies

#### 1. strict-safe-mode
**File:** `policy-packs/strict-safe-mode.json`  
**Severity:** Blocking  
**Use When:** Maximum safety required, no side effects allowed

```bash
# Example usage in pack.json
{
  "policies": ["policy-packs/strict-safe-mode.json"]
}
```

**Rules:**
- All actions must have `safe: true`
- No side effects allowed
- Network access blocked
- Determinism enforced

**Best For:** Critical infrastructure, production safety, audit scenarios

---

#### 2. balanced-ops
**File:** `policy-packs/balanced-ops.json`  
**Severity:** Warning  
**Use When:** Typical operations, development and production

**Rules:**
- Warns on unsafe actions
- Requires dry-run for mutations
- Warns on high latency (>30s)
- Recommends rollback plans

**Best For:** General use, development workflows, standard production

---

### Decision Quality Policies

#### 3. high-signal-junctions
**File:** `policy-packs/high-signal-junctions.json`  
**Severity:** Blocking  
**Use When:** Critical decisions where wrong answers are costly

**Rules:**
- Minimum 80% confidence required
- At least 2 evidence sources
- Evidence must be <24 hours old
- Rationale documentation required

**Best For:** Production deployments, security decisions, financial choices

---

#### 4. low-noise-junctions
**File:** `policy-packs/low-noise-junctions.json`  
**Severity:** Advisory  
**Use When:** Fast decisions, exploratory work, non-critical choices

**Rules:**
- 60% confidence threshold (relaxed)
- Single evidence source acceptable
- Fast timeout (<5s)

**Best For:** Development, testing, low-stakes decisions, rapid iteration

---

### Trust & Security Policies

#### 5. trust-gate-tight
**File:** `policy-packs/trust-gate-tight.json`  
**Severity:** Blocking  
**Use When:** Strict access control, verified identities required

**Rules:**
- Signed attestations required
- Verified identity mandatory
- Full audit logging
- Minimum 'verified' trust tier

**Best For:** Production access, sensitive operations, compliance environments

---

#### 6. trust-gate-relaxed
**File:** `policy-packs/trust-gate-relaxed.json`  
**Severity:** Warning  
**Use When:** Development, testing, local environments

**Rules:**
- Signing optional (advisory)
- Identity optional
- Basic audit logging

**Best For:** Local development, CI/CD testing, sandbox environments

---

### Data Lifecycle Policies

#### 7. retention-conservative
**File:** `policy-packs/compliance/retention-conservative.json`  
**Severity:** Blocking  
**Use When:** Compliance-heavy, audit-critical environments

**Rules:**
- 7+ year retention
- Fingerprints never deleted
- Backup required before compaction
- All compaction audited

**Best For:** Healthcare, finance, legal, compliance-regulated industries

---

#### 8. retention-aggressive
**File:** `policy-packs/compliance/retention-aggressive.json`  
**Severity:** Warning  
**Use When:** Storage-constrained, high-volume, non-critical data

**Rules:**
- 90-day total retention
- Early summarization (3 days)
- Maximum compression
- Aggressive compaction allowed

**Best For:** Development logs, high-volume metrics, temporary data

---

## Policy Pack Schema

All packs validate against `policy-packs/schema.json`:

```json
{
  "$schema": "./schema.json",
  "id": "my-policy",
  "version": "1.0.0",
  "type": "security|cost|quality|infrastructure|compliance",
  "severity": "blocking|warning|advisory",
  "description": "What this policy does",
  "rules": [...],
  "config": {...},
  "metadata": {...}
}
```

## Combining Policy Packs

Multiple packs can be combined. More restrictive rules take precedence:

```json
{
  "policies": [
    "policy-packs/strict-safe-mode.json",
    "policy-packs/high-signal-junctions.json",
    "policy-packs/trust-gate-tight.json"
  ]
}
```

## Creating Custom Policies

1. Copy an existing pack as a template
2. Modify rules and config
3. Validate against schema:
   ```bash
   # Using ajv-cli or similar
   npx ajv validate -s policy-packs/schema.json -d my-policy.json
   ```
4. Test with a sample run
5. Submit a PR to share (optional)

## Policy Severity Levels

| Level | Effect | Use For |
|-------|--------|---------|
| **blocking** | Fails execution | Critical requirements |
| **warning** | Logs but continues | Recommendations |
| **advisory** | Suggestions only | Guidance |

## OSS vs Enterprise

All packs in this directory are **OSS-safe**:
- No cloud dependencies
- No enterprise features required
- Work with local SQLite storage
- Deterministic and replayable

## Examples Using Policy Packs

See the examples directory for working demonstrations:

- `examples/01-quickstart-local/` - Uses `strict-safe-mode`
- `examples/02-diff-and-explain/` - Uses `balanced-ops`
- `examples/03-junction-to-decision/` - Uses `high-signal-junctions`
- `examples/06-retention-compact-safety/` - Uses `retention-conservative`
