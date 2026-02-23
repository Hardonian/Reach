# Presets

Preset configurations for common Reach use cases.

## Quick Start

Choose your path:

```bash
# View all starting paths
./reach presets list

# Preview a preset
./reach presets apply ci-cd-integration --dry-run

# Apply with confirmation
./reach presets apply ci-cd-integration --yes
```

## Directory Structure

```
presets/
├── README.md           # This file
├── map.json            # Starting paths mapping
├── policy/             # Governance and compliance
├── trust/              # Evidence and verification
├── decisions/          # Decision workflow templates
└── junctions/          # Junction rule packs
```

## Starting Paths

### 🚀 CI/CD Integration
**For:** DevOps engineers  
**Presets:** `pack-replay-first-ci`, `fast-path`  
**Goal:** Fast, deterministic CI gates

### 🛡️ Security Review
**For:** Security teams  
**Presets:** `pack-security-basics`, `full-review`  
**Goal:** Policy enforcement with audit trails

### 📄 Compliance Audit
**For:** Auditors  
**Presets:** `audit-ready`, `evidence-strict`  
**Goal:** Compliance-ready documentation

### 🔌 Plugin Development
**For:** Developers  
**Presets:** `plugin-dev`  
**Goal:** Extend Reach with custom plugins

### 🔍 Policy Drift Detection
**For:** Governance teams  
**Presets:** `pack-drift-hunter`  
**Goal:** Monitor policy compliance over time

### 📚 Learning & Exploration
**For:** New users  
**Presets:** None (examples only)  
**Goal:** Learn Reach capabilities

## Applying Presets

```bash
# Dry run to see what would change
./reach presets apply <name> --dry-run

# Apply with backup
./reach presets apply <name> --yes

# Presets are reversible - backup created automatically
```

## Creating Presets

1. Create a directory under the appropriate category
2. Add `preset.json` with configuration
3. Add `README.md` with usage instructions
4. Test with `--dry-run` before committing
