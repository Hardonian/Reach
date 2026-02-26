# CI/CD Integration Guide

Integrate Reach into your continuous integration and deployment pipelines for automated determinism verification and governance gates.

## Overview

Reach provides native integrations with popular CI/CD platforms:

- **GitHub Actions** - Native action with PR comments
- **GitLab CI** - Built-in CI template
- **CircleCI** - Orb support
- **Jenkins** - Plugin available
- **Azure DevOps** - Extension support
- **Generic** - Any CI via Docker

## Quick Start

### GitHub Actions

Create `.github/workflows/reach.yml`:

```yaml
name: Reach Determinism Check

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  determinism:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Reach
        run: |
          curl -sSL https://github.com/reach/reach/releases/latest/download/install.sh | bash
          echo "$HOME/.reach/bin" >> $GITHUB_PATH

      - name: Check Environment
        run: reach doctor

      - name: Run Determinism Check
        run: reach verify-determinism --trials 3

      - name: Run Evaluation Suite
        run: reach eval run --pack sentinel --dataset test-suite

      - name: Create Capsule
        if: github.event_name == 'pull_request'
        run: |
          reach run my-pack
          reach capsule create $(reach runs list --latest) --output pr-${GITHUB_SHA}.capsule.json

      - name: Upload Capsule
        if: github.event_name == 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: reach-capsule
          path: pr-*.capsule.json
```

### GitLab CI

Add to `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - verify

reach:determinism:
  stage: test
  image: reach/cli:latest
  script:
    - reach doctor
    - reach verify-determinism
    - reach eval run --pack $CI_PROJECT_NAME --dataset ci-suite
  artifacts:
    paths:
      - "*.capsule.json"
    expire_in: 1 week

reach:gate:
  stage: verify
  image: reach/cli:latest
  script:
    - reach gate run --policy integrity-shield
  only:
    - merge_requests
```

### CircleCI

Add to `.circleci/config.yml`:

```yaml
version: 2.1

orbs:
  reach: reach/reach@1.0

workflows:
  determinism:
    jobs:
      - reach/verify:
          pack: my-pack
          dataset: test-suite
      - reach/gate:
          policy: integrity-shield
          requires:
            - reach/verify
```

## Advanced Configuration

### PR Gates

Block pull requests that fail determinism checks:

```yaml
- name: PR Gate
  run: |
    reach gate run \
      --name "integrity-check" \
      --on-fail block \
      --report-to-github
```

### Drift Detection

Detect when your pack behavior changes:

```yaml
- name: Check for Drift
  run: |
    reach eval compare \
      $(reach eval list --latest --limit 1) \
      $(reach eval list --baseline --limit 1) \
      --threshold 5%
```

### Matrix Testing

Test across multiple configurations:

```yaml
strategy:
  matrix:
    node: [18, 20, 21]
    os: [ubuntu, windows, macos]

steps:
  - name: Test ${{ matrix.os }} / Node ${{ matrix.node }}
    run: |
      reach run my-pack --env NODE_VERSION=${{ matrix.node }}
      reach verify-determinism
```

## Pre-commit Hooks

Add to `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: reach-doctor
        name: Reach Environment Check
        entry: reach doctor --quiet
        language: system
        pass_filenames: false

      - id: reach-verify
        name: Reach Determinism Check
        entry: reach verify-determinism
        language: system
        pass_filenames: false
        files: "^src/"
```

## Docker Usage

For CI systems without native support:

```yaml
steps:
  - name: Reach Determinism
    image: reach/cli:latest
    commands:
      - reach doctor
      - reach verify-determinism
    volumes:
      - ./:/workspace
    working_dir: /workspace
```

## Environment Variables

| Variable          | Description                   |
| ----------------- | ----------------------------- |
| `REACH_API_TOKEN` | API key for cloud features    |
| `REACH_ORG_ID`    | Organization ID for team runs |
| `REACH_BASE_URL`  | Custom cloud endpoint         |
| `REACH_LOG_LEVEL` | debug, info, warn, error      |
| `REACH_CI_MODE`   | Set automatically in CI       |

## Best Practices

### 1. Pin Your Reach Version

```yaml
- name: Install Reach
  run: |
    curl -sSL https://github.com/reach/reach/releases/download/v0.3.3/install.sh | bash
```

### 2. Cache Reach Data

```yaml
- name: Cache Reach
  uses: actions/cache@v4
  with:
    path: |
      ~/.reach
      ./data
    key: reach-${{ runner.os }}-${{ hashFiles('reach.lock') }}
```

### 3. Artifact Capsules

Always archive capsules for audit trails:

```yaml
- name: Archive Results
  uses: actions/upload-artifact@v4
  with:
    name: reach-evidence-${{ github.sha }}
    path: |
      data/capsules/
      *.capsule.json
    retention-days: 90
```

### 4. Parallel Evaluation

```yaml
jobs:
  eval-unit:
    runs-on: ubuntu-latest
    steps:
      - run: reach eval run --dataset unit-tests

  eval-integration:
    runs-on: ubuntu-latest
    steps:
      - run: reach eval run --dataset integration-tests

  eval-e2e:
    runs-on: ubuntu-latest
    steps:
      - run: reach eval run --dataset e2e-tests
```

## Troubleshooting

### "reach: command not found"

Add to PATH explicitly:

```yaml
- run: echo "$HOME/.reach/bin" >> $GITHUB_PATH
```

### Timeouts in CI

Increase timeout for slow environments:

```yaml
- run: reach verify-determinism --timeout 300
```

### Determinism Failures

Check for:

- Uncommitted changes
- Environment-specific files
- Time-based logic
- Random number generation

## Examples

See the [examples/ci](https://github.com/reach/reach/tree/main/examples/ci) directory for complete working configurations.

## Support

- [CI Troubleshooting](./troubleshooting.md#ci-issues)
- [GitHub Discussions](https://github.com/reach/reach/discussions)
- [Enterprise Support](./support.md)
