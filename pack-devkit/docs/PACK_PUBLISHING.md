# Pack Publishing Guide This guide covers publishing Reach Execution Packs to a registry using the PR-based workflow.

## Overview Reach uses an **OSS-first, PR-based publishing model**. No centralized SaaS is required.

## Publishing Workflow ### 1. Prepare Your Pack

```bash
# Create a pack from template reach pack init --template governed-minimal my-pack

# Develop your pack... # Verify it's ready
reach pack doctor my-pack
```

### 2. Test Thoroughly ```bash
# Run lint checks reach pack lint my-pack

# Run conformance tests reach pack test my-pack

# Full health check reach pack doctor my-pack --json
```

### 3. Generate PR Bundle ```bash
# Generate publishing bundle reach pack publish my-pack --registry https://github.com/reach/registry

# Output: # {
# "pack": "my-pack", # "version": "1.0.0",
# "bundle_path": "my-pack/publish-bundle", # "branch_name": "add-pack-my-pack-1.0.0",
# "instructions": "my-pack/publish-bundle/PR_INSTRUCTIONS.md" # }
```

### 4. Submit PR The bundle contains:
- `bundle.json`: Machine-readable bundle metadata
- `PR_INSTRUCTIONS.md`: Human-readable instructions
- `registry/my-pack.json`: Registry entry
- `packs/my-pack/1.0.0/pack.json`: Pack content

#### Option A: Using GitHub CLI ```bash
cd my-pack/publish-bundle
cat PR_INSTRUCTIONS.md

# Follow the instructions to: # 1. Clone the registry
# 2. Create a branch # 3. Copy files
# 4. Submit PR git clone https://github.com/reach/registry
cd registry
git checkout -b add-pack-my-pack-1.0.0
cp -r ../my-pack/publish-bundle/* .
git add .
git commit -m "Add pack: my-pack v1.0.0"
git push origin add-pack-my-pack-1.0.0
gh pr create --title "Add pack: my-pack v1.0.0"
```

#### Option B: Manual PR 1. Fork the registry repository
2. Create a new branch
3. Copy files from the bundle
4. Submit a pull request through the web interface

## Registry Entry Format ```json
{
  "name": "my-pack",
  "repo": "https://github.com/reach/registry",
  "spec_version": "1.0",
  "signature": "sha256:abc123...",
  "reproducibility": "deterministic",
  "verified": true,
  "author": "your-name",
  "version": "1.0.0",
  "description": "A great pack",
  "tags": ["utility", "data-processing"],
  "hash": "sha256:def456...",
  "published_at": "2024-01-01T00:00:00Z",
  "attestation": {
    "lint_passed": true,
    "tests_passed": true,
    "determinism_hash": "abc123...",
    "replay_verified": true,
    "signed": true,
    "verified_at": "2024-01-01T00:00:00Z"
  }
}
```

## Verification Requirements Before a pack is accepted to the registry:

- [ ] Lint checks pass
- [ ] Conformance tests pass
- [ ] Determinism verified (if claimed)
- [ ] Policy contract valid (if governed)
- [ ] Signing metadata present (if required)
- [ ] Description is accurate
- [ ] No forbidden patterns detected

## CI Gates Registry repositories should enable CI gates:

```yaml
# .github/workflows/verify-pack.yml name: Verify Pack
on: [pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Verify packs
        run: |
          for pack in packs/*/*/; do
            reach pack lint "$pack"
            reach pack test "$pack"
          done
```

## Best Practices 1. **Version properly**: Use semantic versioning
2. **Sign your packs**: Required for governed packs
3. **Test thoroughly**: Run all conformance tests
4. **Document clearly**: Write helpful descriptions
5. **Keep it minimal**: Only declare tools you need
6. **Verify determinism**: Ensure reproducible execution

## Troubleshooting ### Lint Failures

```bash
# See detailed lint output reach pack lint my-pack --json
```

### Missing Files Ensure your pack has:
- `pack.json` (required)
- `README.md` (required)
- `policy.rego` (if governed)

### Signing Issues ```bash
# Generate signing key reach pack generate-key --output signing.key

# Sign the pack reach pack sign my-pack --key signing.key
```
