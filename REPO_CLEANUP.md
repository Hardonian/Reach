# Repository Size Cleanup Guide

## Current State

| Metric | Value |
|--------|-------|
| **.git directory** | ~238 MB |
| **.exe files in history** | ~452 MB (uncompressed) |
| **.zip files in history** | ~40 MB (uncompressed) |
| **Total large blobs** | ~492 MB |

### Largest Files in History

```
24.72 MB  ARTIFACTS/stitch_readylayer_home_page_redesign
23.42 MB  stitch_readylayer_home_page_redesign.zip
15.73 MB  services/runner/reachctl_new.exe
15.70 MB  services/runner/reachctl.exe
15.62 MB  services/runner/reachctl.exe
15.54 MB  reachctl.exe
... (many more .exe files)
```

## Cleanup Scripts

Choose one of the following approaches:

### Option 1: git-filter-repo (Recommended - Fastest)

Install:
```bash
pip install git-filter-repo
```

Run:
```bash
bash scripts/shrink-repo.sh
```

### Option 2: BFG Repo-Cleaner (Easiest)

Download:
```bash
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
```

Run:
```bash
bash scripts/shrink-repo-bfg.sh
```

### Option 3: git filter-branch (Built-in - Slowest)

```bash
bash scripts/shrink-repo.sh
# (falls back to filter-branch if filter-repo not installed)
```

Or on Windows:
```powershell
.\scripts\shrink-repo.ps1
```

---

## ⚠️ Critical Warnings

### 1. Coordinate with Team
```
This changes ALL commit hashes. Everyone must reclone or reset.
```

### 2. Create Backup First
```bash
git branch backup-before-cleanup-$(date +%Y%m%d)
```

### 3. Force Push Required
```bash
git push origin --force --all
git push origin --force --tags
```

### 4. Team Member Update
Everyone on the team must:
```bash
# Option A: Reclone
git clone <repo-url>

# Option B: Reset
git fetch origin
git reset --hard origin/main  # or main/master branch
```

---

## Expected Results

After cleanup:

| Metric | Before | After (Est.) |
|--------|--------|--------------|
| .git size | ~238 MB | ~30-50 MB |
| Clone time | Slow | Fast |
| CI/CD time | Slow | Fast |

---

## What Gets Removed

- All `.exe` files from history (~452 MB)
- All `.zip` files from history (~40 MB)
- Any blob larger than 10 MB

What stays:
- Source code
- Documentation
- Small config files
- Everything else under 10 MB

---

## Rollback Plan

If something goes wrong:

```bash
# Restore from backup
git reset --hard backup-before-cleanup-YYYYMMDD

# Or fetch from remote if not yet force-pushed
git fetch origin
git reset --hard origin/main
```

---

## Verification After Cleanup

```bash
# Verify tests still pass
cd services/runner
go test ./...

# Check binary can be built
go build ./cmd/reachctl

# Verify no large files remain in history
git rev-list --objects --all | \
    git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
    awk '$1 == "blob" && $3 > 10485760 {print $3, $4}' | \
    sort -rn
```

---

## Quick Command Summary

```bash
# 1. Install tool
pip install git-filter-repo

# 2. Run cleanup
bash scripts/shrink-repo.sh

# 3. Verify
make test

# 4. Force push
git push --force --all
```

---

## Need Help?

- [BFG Repo-Cleaner docs](https://rtyley.github.io/bfg-repo-cleaner/)
- [git-filter-repo docs](https://htmlpreview.github.io/?https://github.com/newren/git-filter-repo/blob/docs/html/git-filter-repo.html)
- GitHub docs: [Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
