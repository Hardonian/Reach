# Recipe A: Add a Deterministic Check

Create a custom validation check that maintains Reach's determinism guarantees.

## Overview

**Time:** 15 minutes  
**Difficulty:** Beginner  
**Capability:** `registerPolicy`

## What You'll Build

A plugin that validates decisions against custom business rules with deterministic output.

## Step-by-Step

### 1. Scaffold the Plugin

```bash
./reach plugins scaffold deterministic-check
```

### 2. Define the Check

Edit `plugins/deterministic-check/index.js`:

```javascript
/**
 * Deterministic Check Plugin
 *
 * Validates that decisions meet specific criteria.
 * Uses only deterministic operations.
 */

// Deterministic: uses only input parameters, no random, no external state
function validateEvidenceCount(decision, options = {}) {
  const minEvidence = options.minEvidence || 1;
  const evidence = decision.evidence || [];

  return {
    passed: evidence.length >= minEvidence,
    details: {
      count: evidence.length,
      required: minEvidence,
      // Deterministic: sorted keys for consistent serialization
      timestamp: evidence.map((e) => e.timestamp).sort(),
    },
  };
}

function validateEvidenceFreshness(decision, options = {}) {
  const maxAge = options.maxAgeMs || 7 * 24 * 60 * 60 * 1000; // 7 days
  const evidence = decision.evidence || [];
  const now = options.referenceTime || 0; // Deterministic: passed in, not Date.now()

  const staleEvidence = evidence.filter((e) => {
    const age = now - (e.timestamp || 0);
    return age > maxAge;
  });

  return {
    passed: staleEvidence.length === 0,
    details: {
      staleCount: staleEvidence.length,
      totalCount: evidence.length,
      // Deterministic: sorted for consistent output
      staleIds: staleEvidence.map((e) => e.id).sort(),
    },
  };
}

module.exports = {
  name: "deterministic-check",
  version: "1.0.0",

  register(hooks) {
    hooks.registerPolicy("evidence-count", validateEvidenceCount);
    hooks.registerPolicy("evidence-freshness", validateEvidenceFreshness);
  },
};
```

### 3. Update Plugin Manifest

Edit `plugins/deterministic-check/plugin.json`:

```json
{
  "id": "deterministic-check",
  "name": "Deterministic Check Plugin",
  "version": "1.0.0",
  "capabilities": ["registerPolicy"],
  "deterministic": true,
  "entry": "index.js",
  "config": {
    "minEvidence": 1,
    "maxAgeMs": 604800000
  }
}
```

### 4. Add README

Create `plugins/deterministic-check/README.md`:

```markdown
# Deterministic Check Plugin

Validates decisions against specific criteria.

## Checks

- **evidence-count**: Ensures minimum evidence count
- **evidence-freshness**: Validates evidence isn't stale

## Usage

\`\`\`javascript
// In your decision config
{
"policies": ["evidence-count", "evidence-freshness"],
"policyConfig": {
"evidence-count": { "minEvidence": 3 },
"evidence-freshness": { "maxAgeMs": 86400000 }
}
}
\`\`\`
```

### 5. Validate

```bash
./reach plugins validate plugins/deterministic-check
```

## Key Principles

1. **No `Date.now()`** - Pass reference time as parameter
2. **No `Math.random()`** - Use seeded random if needed
3. **Sorted outputs** - Sort arrays/keys before returning
4. **Pure functions** - Same input → same output

## Testing

```javascript
// test.js
const plugin = require("./index.js");

const mockDecision = {
  evidence: [
    { id: "ev1", timestamp: 1000 },
    { id: "ev2", timestamp: 2000 },
  ],
};

// Deterministic: always same result
const result1 = plugin.validateEvidenceCount(mockDecision, { minEvidence: 2 });
const result2 = plugin.validateEvidenceCount(mockDecision, { minEvidence: 2 });

console.assert(result1.passed === result2.passed, "Must be deterministic");
console.log("✓ Test passed");
```

## Next Steps

- Recipe B: Junction Templates
- Recipe E: Policy Validator Hooks (advanced)
