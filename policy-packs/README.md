# Reach Policy Packs

A collection of reusable policy packs for governing Reach executions.

## What Are Policy Packs?

Policy packs are declarative rule sets that govern:
- **Cost** - Budget limits and spending controls
- **Security** - Vulnerability scanning and compliance
- **Quality** - Confidence thresholds and evidence requirements
- **Infrastructure** - Resource limits and configuration guardrails

## Quick Start

```bash
# List available policy packs
reach policy list

# Apply a policy pack
reach policy apply cost-ceiling-default

# Check policy status
reach policy status

# Evaluate a run against policies
reach eval --policy-pack cost-ceiling-default
```

## Available Packs

### Infrastructure Policies

| Policy | Description | Severity |
|--------|-------------|----------|
| `cost-ceiling-1k` | Monthly spend limit $1,000 | blocking |
| `require-tags` | All resources must have required tags | blocking |
| `security-no-high-severity` | Block high-severity misconfigurations | blocking |
| `allowed-regions` | Restrict deployment regions | warning |

### Cost Policies

| Policy | Description | Severity |
|--------|-------------|----------|
| `cost-hard-ceiling` | Hard stop on budget exceeded | blocking |
| `cost-soft-ceiling` | Warn at 80% of budget | warning |
| `model-tier-routing` | Auto-route based on budget | advisory |

### Security Policies

| Policy | Description | Severity |
|--------|-------------|----------|
| `no-secrets-in-output` | Scan for leaked secrets | blocking |
| `required-encryption` | Require encrypted storage | blocking |
| `network-isolation` | Enforce network boundaries | warning |

### Quality Policies

| Policy | Description | Severity |
|--------|-------------|----------|
| `min-confidence-0.7` | Require 70% confidence | blocking |
| `require-evidence` | Evidence required for decisions | blocking |
| `voi-threshold` | Suggest evidence when uncertain | advisory |

## Pack Structure

```
policy-packs/
├── infrastructure/
│   ├── cost-ceiling.json
│   ├── require-tags.json
│   └── README.md
├── cost/
│   ├── cost-ceiling.json
│   └── README.md
└── ...
```

Each policy file:
```json
{
  "id": "policy-name",
  "version": "1.0.0",
  "type": "cost|security|quality|infrastructure",
  "severity": "blocking|warning|advisory",
  "rules": [...],
  "description": "Human-readable description"
}
```

## Creating Custom Policies

1. Create a new JSON file in the appropriate directory
2. Define your rules
3. Test with `reach policy validate`
4. Submit a PR to share with the community

## Policy Severity Levels

- **blocking** - Fail the execution if violated
- **warning** - Log violation but continue
- **advisory** - Suggest improvements only

## Loading Policies

Policies are loaded automatically from:
1. Built-in packs (this directory)
2. `./policies/` in your project
3. `~/.reach/policies/` for user policies

Or specify explicitly:
```bash
reach run --policies ./my-custom-policies/
```
