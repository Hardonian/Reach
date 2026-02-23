# Analyzer Example Plugin

A sample plugin demonstrating custom PR/code analysis capabilities.

## What It Does

This analyzer provides two analysis types:

1. **Complexity Check** - Identifies long functions and code smells
2. **Security Check** - Detects potential security issues

## Installation

This plugin is included as an example. To use:

```bash
# Verify plugin loads correctly
reach plugins doctor

# The analyzer will be available for PR analysis
reach analyze-pr --with-plugin analyzer-example
```

## Analyzers

### complexity-check

Checks for:
- Functions over 50 lines
- TODO/FIXME comments
- console.log statements

### security-check

Checks for:
- Hardcoded passwords
- Hardcoded API keys
- Hardcoded secrets
- eval() usage

## Output Format

```json
[
  {
    "type": "warning",
    "message": "Function is 65 lines (consider refactoring)",
    "line": 42,
    "severity": "medium",
    "rule": "function-length"
  }
]
```

## Extending

Add more analyzers by extending the `analyzers` array in `index.js`:

```javascript
{
  id: "my-custom-check",
  category: "quality",
  deterministic: true,
  analyze(input) {
    // Your analysis logic
    return findings;
  }
}
```

## Notes

- This is a simplified example for demonstration
- Real analyzers would use AST parsing
- Always test analyzers on sample inputs
