# Security Basics Pack Plugin

Essential security checks for workspace integrity.

## Part of Pack

This plugin is part of the `security-basics` pack:
- **Pack**: `packs/security-basics/`
- **Recipes**: `security-scan`, `integrity-check`
- **Rules**: `no-secrets-in-logs`, `verified-artifacts-only`

## Analyzers

### security-scan

Scans for common security issues.

Detects:
- AWS credentials
- Private keys
- Hardcoded passwords
- API keys
- Dangerous functions (eval, exec, system)

```javascript
// Input
{
  content: "const password = 'secret123';",
  filename: "config.js",
  workspace: "/path/to/workspace"
}

// Output
[
  {
    type: "error",
    message: "Hardcoded password detected (password_assignment)",
    severity: "high",
    rule: "no-secrets-in-logs",
    file: "config.js"
  }
]
```

### integrity-check

Verifies artifact and workspace integrity.

```javascript
// Input
{
  artifacts: { "build.js": "console.log('hello')" },
  expectedHashes: { "build.js": "abc123..." },
  workspace: "/path/to/workspace"
}

// Output
[
  { type: "success", message: "Artifact verified: build.js", severity: "low" },
  { type: "warning", message: "Missing recommended file: .gitignore", severity: "low" }
]
```

## Evidence Extractor

Collects security-relevant evidence:
- Platform info
- Environment variables
- File permissions

## Determinism

All operations are deterministic:
- Sorted pattern matching
- Sorted object keys
- Consistent severity ranking
- Stable output format
