# Activate GitHub PR Gates

Protect your repository by running ReadyLayer checks on every Pull Request. This ensures no breaking changes reach production.

## 10-second Explanation

ReadyLayer Gates verify agent logic, policy compliance, and resource usage before code is merged. Every PR gets a "Pass/Fail" status directly in GitHub.

## Quick Setup

### 1. Install CLI

```bash
npm install -g @readylayer/cli
```

### 2. Connect Repo

```bash
reach gate connect --repo owner/name --token $READYLAYER_TOKEN
```

### 3. Add Workflow

Create `.github/workflows/readylayer-gate.yml`:

```yaml
name: ReadyLayer Gate
on: [pull_request]
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: reach gate run --sha ${{ github.event.pull_request.head.sha }}
        env:
          READYLAYER_TOKEN: ${{ secrets.READYLAYER_TOKEN }}
```

## Success Checklist

- [ ] GitHub App installed on repository.
- [ ] `READYLAYER_TOKEN` added to GitHub Secrets.
- [ ] Workflow file committed to main.
- [ ] First check appears on Pull Requests.

## First PR Test

1. Create a new branch.
2. Make a small code change.
3. Open a Pull Request.
4. Verify the "ReadyLayer Gate" check appears and completes.

If it fails: [Troubleshooting Guide](./TROUBLESHOOTING.md)
