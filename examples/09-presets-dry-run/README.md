# Example 09: Presets Dry Run

**Purpose:** Safely preview configuration changes before applying them.

**Level:** Beginner  
**Estimated Time:** 3 minutes  
**Requires:** `reach` CLI

---

## Quick Run

```bash
node examples/09-presets-dry-run/run.js
```

---

## What This Example Demonstrates

1. **List Available Presets** - View all starting paths and presets
2. **Dry Run Preview** - See what would change without modifying files
3. **Compare Presets** - Understand differences between configurations
4. **Safe Application** - Apply with confidence after preview

---

## Manual Steps

### Step 1: List All Presets

```bash
./reach presets list
```

**Expected output:**

```
Available Presets:

  ci-cd-integration:
    - pack-replay-first-ci
    - fast-path

  security-review:
    - pack-security-basics
    - full-review

  compliance-audit:
    - audit-ready
    - evidence-strict

  plugin-development:
    - plugin-dev

  policy-drift-detection:
    - pack-drift-hunter
```

### Step 2: Preview a Preset (Dry Run)

```bash
./reach presets apply ci-cd-integration --dry-run
```

**Expected output:**

```
▶ Preset: ci-cd-integration
  Mode: DRY RUN (no changes will be made)

Changes to be applied:
  CREATE  .reach/config.ci.yml
  CREATE  .github/workflows/reach-ci.yml
  MODIFY  .reach/config.yml (add ci profile)

Summary:
  Files created: 2
  Files modified: 1
  Files deleted: 0

Run without --dry-run to apply these changes.
```

### Step 3: Compare Multiple Presets

```bash
# Preview security preset
./reach presets apply security-review --dry-run

# Preview compliance preset
./reach presets apply compliance-audit --dry-run
```

### Step 4: Apply After Review

Once you've reviewed the changes:

```bash
./reach presets apply ci-cd-integration --yes
```

**Expected output:**

```
▶ Preset: ci-cd-integration
  Backup: .reach/backups/preset-20240223-001/

Applying changes:
  ✓ CREATE  .reach/config.ci.yml
  ✓ CREATE  .github/workflows/reach-ci.yml
  ✓ MODIFY  .reach/config.yml

Preset applied successfully.
Rollback: ./reach presets rollback ci-cd-integration
```

---

## Files

| File                     | Purpose                             |
| ------------------------ | ----------------------------------- |
| `run.js`                 | Automated preset exploration script |
| `preset-comparison.json` | Comparison of preset configurations |

---

## Expected Results

```
=== Presets Dry Run Demo ===

1. Listing available presets...
   ✓ Found 6 preset categories

   Categories:
   - ci-cd-integration (2 presets)
   - security-review (2 presets)
   - compliance-audit (2 presets)
   - plugin-development (1 preset)
   - policy-drift-detection (2 presets)
   - learning-exploration (0 presets)

2. Dry run: ci-cd-integration...
   Mode: DRY RUN
   Files created: 2
   Files modified: 1
   ✓ Preview complete, no changes made

3. Dry run: security-review...
   Mode: DRY RUN
   Files created: 3
   Files modified: 1
   ✓ Preview complete, no changes made

4. Comparison summary...
   CI/CD preset:        CI workflows, fast paths
   Security preset:     Policy enforcement, audit rules
   Compliance preset:   Retention, evidence collection

5. Apply with confidence...
   To apply: ./reach presets apply <name> --yes
   To rollback: ./reach presets rollback <name>

Status: ✓ READY (review complete)
```

---

## Common Presets Reference

| Preset              | Use Case                    | Files Added                 |
| ------------------- | --------------------------- | --------------------------- |
| `ci-cd-integration` | GitHub Actions integration  | Workflow files, CI config   |
| `security-review`   | Security policy enforcement | Security policies, rules    |
| `compliance-audit`  | Audit-ready configuration   | Retention policies, logging |
| `plugin-dev`        | Plugin development setup    | Scaffold files, templates   |
| `pack-drift-hunter` | Policy drift detection      | Drift rules, monitoring     |

---

## Safety Features

### Automatic Backups

Every preset application creates a backup:

```bash
# View available backups
ls -la .reach/backups/

# Rollback to previous state
./reach presets rollback ci-cd-integration
```

### Differential Preview

The `--dry-run` flag shows:

- Files that will be created
- Files that will be modified
- Files that will be deleted
- Configuration changes

---

## Key Takeaways

- Always use `--dry-run` before applying presets
- Presets are categorized by use case (CI/CD, Security, Compliance)
- Automatic backups enable safe rollback
- No changes are made without explicit `--yes` flag

---

## What To Try Next

1. Apply the `security-review` preset to your project
2. Explore the generated configuration files
3. Try the [Export Verify Workflow](../08-export-verify-workflow/) to test your setup
