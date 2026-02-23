# Starter PRs

Tiny, safe PRs to get familiar with the contribution workflow. Each can be completed in 30-60 minutes.

---

## PR #1: Fix Typo in Error Message

**Files:** `tools/doctor/main.go` (line ~140)  
**Time:** 15 minutes  
**Risk:** Zero

### What to Do

Fix a typo in the doctor output where "remediation" is misspelled as "remidiation".

### Steps

1. **Find the typo:**
   ```bash
   grep -n "remidiation" tools/doctor/main.go
   ```

2. **Fix it:**
   ```go
   // Change:
   fmt.Printf("       remidiation: %s\n", result.remediation)
   // To:
   fmt.Printf("       remediation: %s\n", result.remediation)
   ```

3. **Verify:**
   ```bash
   cd tools/doctor && go build && ./doctor
   # Check output shows "remediation:" not "remidiation:"
   ```

### PR Description Template

```markdown
## Summary
Fix typo in doctor output: "remidiation" → "remediation"

## Changes
- Fixed typo in tools/doctor/main.go line 140

## Testing
```bash
$ ./reach doctor
[OK]   git installed and accessible
[OK]   go installed
...
# Output shows correct spelling
```

## Checklist
- [x] Built and tested locally
- [x] No functional changes
```

---

## PR #2: Add README Badges

**Files:** `README.md` (top of file)  
**Time:** 30 minutes  
**Risk:** Very Low

### What to Do

Add helpful badges to the README for quick project status.

### Steps

1. **Add badges after the title:**
   ```markdown
   # Reach
   
   [![CI Status](https://github.com/reach/reach/actions/workflows/ci.yml/badge.svg)](https://github.com/reach/reach/actions)
   [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
   [![Version](https://img.shields.io/badge/version-0.3.1-blue.svg)](VERSION)
   [![Go Report Card](https://goreportcard.com/badge/github.com/reach/reach)](https://goreportcard.com/report/github.com/reach/reach)
   ```

2. **Verify:**
   - Preview README in GitHub
   - Click each badge to confirm links work

### PR Description Template

```markdown
## Summary
Add project status badges to README for quick visibility.

## Changes
- Added CI status badge
- Added License badge
- Added Version badge
- Added Go Report Card badge

## Testing
- [x] Previewed README rendering
- [x] Verified all badge links work
- [x] Badges display correctly in light/dark mode

## Checklist
- [x] No code changes
- [x] Documentation only
```

---

## PR #3: Add .editorconfig

**Files:** `.editorconfig` (new file)  
**Time:** 20 minutes  
**Risk:** Zero

### What to Do

Add EditorConfig file to standardize editor settings across contributors.

### Steps

1. **Create `.editorconfig`:**
   ```ini
   # EditorConfig is awesome: https://EditorConfig.org
   root = true

   [*]
   charset = utf-8
   end_of_line = lf
   insert_final_newline = true
   trim_trailing_whitespace = true
   indent_style = space
   indent_size = 2

   [*.go]
   indent_style = tab
   indent_size = 4

   [*.rs]
   indent_size = 4

   [*.md]
   trim_trailing_whitespace = false
   max_line_length = 80

   [Makefile]
   indent_style = tab
   ```

2. **Verify:**
   ```bash
   # Install editorconfig CLI if available
   npm install -g editorconfig
   editorconfig --version
   ```

### PR Description Template

```markdown
## Summary
Add .editorconfig to standardize editor settings.

## Changes
- Created .editorconfig with settings for:
  - General files (2-space indent)
  - Go files (tabs, 4-space)
  - Rust files (4-space)
  - Markdown (preserve trailing spaces)
  - Makefiles (tabs)

## Testing
- [x] File is valid EditorConfig format
- [x] Settings align with existing code style

## Checklist
- [x] No code changes
- [x] Developer experience improvement
```

---

## PR #4: Fix Excess Whitespace in help Output

**Files:** `services/runner/internal/cli/help.go` or similar  
**Time:** 30 minutes  
**Risk:** Very Low

### What to Do

Remove extra blank lines in CLI help output for cleaner display.

### Steps

1. **Find help text:**
   ```bash
   grep -r "Usage:" services/runner --include="*.go" | head -5
   ./reach --help 2>&1 | cat -A  # Show hidden characters
   ```

2. **Identify extra newlines:**
   Look for `\n\n\n` (triple newline) or trailing spaces.

3. **Fix and verify:**
   ```bash
   ./reach --help 2>&1 | wc -l  # Note line count
   # Make fix
   ./reach --help 2>&1 | wc -l  # Should be fewer lines
   ```

### PR Description Template

```markdown
## Summary
Clean up excess whitespace in CLI help output.

## Changes
- Removed extra blank lines in help text
- Fixed trailing whitespace in command descriptions

## Before/After
```
# Before: 45 lines
# After: 38 lines
```

## Testing
- [x] Help output displays correctly
- [x] No functional changes

## Checklist
- [x] Visual improvement only
```

---

## PR #5: Add JSON Schema for Fixtures

**Files:** `fixtures/schema.json` (new file)  
**Time:** 45 minutes  
**Risk:** Low

### What to Do

Create a JSON Schema to validate fixture files.

### Steps

1. **Create basic schema:**
   ```json
   {
     "$schema": "http://json-schema.org/draft-07/schema#",
     "$id": "https://reach.dev/schemas/fixture.json",
     "title": "Reach Fixture",
     "type": "object",
     "required": ["_fixture"],
     "properties": {
       "_fixture": {
         "type": "object",
         "required": ["id", "description", "created", "schema_version"],
         "properties": {
           "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
           "description": { "type": "string", "minLength": 10 },
           "created": { "type": "string", "format": "date" },
           "schema_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
           "complexity": { "enum": ["beginner", "intermediate", "advanced"] },
           "deterministic": { "type": "boolean" }
         }
       }
     }
   }
   ```

2. **Test against existing fixtures:**
   ```bash
   # Using ajv-cli
   npx ajv-cli validate -s fixtures/schema.json -d "fixtures/events/*.json"
   ```

### PR Description Template

```markdown
## Summary
Add JSON Schema for validating fixture files.

## Changes
- Created fixtures/schema.json
- Schema validates _fixture metadata structure
- Supports complexity levels: beginner/intermediate/advanced

## Testing
```bash
$ npx ajv-cli validate -s fixtures/schema.json -d "fixtures/events/*.json"
fixtures/events/simple-decision.json valid
fixtures/events/multi-action.json valid
fixtures/events/adversarial.json valid
fixtures/events/tie-break.json valid
```

## Checklist
- [x] Schema is valid JSON Schema draft-07
- [x] All existing fixtures validate
- [x] Documentation added to fixtures/README.md
```

---

## How to Submit These PRs

### 1. Fork and Branch

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/reach.git
cd reach
git checkout -b fix/typo-doctor-output
```

### 2. Make Changes

```bash
# Edit files
vim tools/doctor/main.go

# Test locally
./reach doctor
```

### 3. Commit

```bash
git add tools/doctor/main.go
git commit -m "fix: correct typo in doctor output

'remidiation' -> 'remediation'"
```

### 4. Push and PR

```bash
git push origin fix/typo-doctor-output
# Open PR on GitHub
```

---

## What Makes a Good Starter PR

| Quality | Why It Matters |
|---------|----------------|
| **Single purpose** | Easy to review, quick to merge |
| **No dependencies** | Can be reviewed in isolation |
| **Testable** | Reviewer can verify easily |
| **Documentation** | Shows you understand the change |
| **Small diff** | <20 lines preferred, <100 max |

---

## After Your First PR

Once merged, you're ready for:
- [Good First Issues](./good-first-issues.md) - Larger scoped issues
- [PR Guidelines](./pr-guidelines.md) - Full PR standards
- [Contributing Guide](../../CONTRIBUTING.md) - Complete setup

Welcome to the Reach community! 🎉
