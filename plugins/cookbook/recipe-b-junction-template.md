# Recipe B: Add a New Junction Template

Create reusable decision templates that can be instantiated multiple times.

## Overview

**Time:** 20 minutes  
**Difficulty:** Intermediate  
**Capability:** `registerDecisionType`

## What You'll Build

A junction template for security review decisions with pre-defined evidence requirements.

## Step-by-Step

### 1. Scaffold the Plugin

```bash
./reach plugins scaffold security-review-template
```

### 2. Define the Template

Edit `plugins/security-review-template/index.js`:

```javascript
/**
 * Security Review Junction Template
 * 
 * Pre-configured template for security review decisions.
 */

const SECURITY_REVIEW_TEMPLATE = {
  type: 'security-review',
  requiredEvidence: [
    { type: 'threat-model', minCount: 1 },
    { type: 'security-scan', minCount: 1 },
    { type: 'review-approval', minCount: 1 },
  ],
  policies: ['evidence-completeness', 'no-high-severity-issues'],
  reviewHorizon: '7d',
}

function createSecurityReview(options = {}) {
  const id = `sec-review-${options.id || 'default'}`
  
  return {
    id,
    template: SECURITY_REVIEW_TEMPLATE,
    evidence: [],
    config: {
      autoReview: options.autoReview ?? true,
      blockOnFailure: options.blockOnFailure ?? true,
    }
  }
}

function validateCompleteness(decision) {
  const template = decision.template || SECURITY_REVIEW_TEMPLATE
  const evidence = decision.evidence || []
  
  const missing = template.requiredEvidence.filter(req => {
    const count = evidence.filter(e => e.type === req.type).length
    return count < req.minCount
  })
  
  return {
    passed: missing.length === 0,
    missing: missing.map(m => m.type).sort(), // Deterministic
  }
}

module.exports = {
  name: 'security-review-template',
  version: '1.0.0',
  
  register(hooks) {
    hooks.registerDecisionType('security-review', {
      create: createSecurityReview,
      validate: validateCompleteness,
    })
  }
}
```

### 3. Update Manifest

Edit `plugins/security-review-template/plugin.json`:

```json
{
  "id": "security-review-template",
  "name": "Security Review Template",
  "version": "1.0.0",
  "capabilities": ["registerDecisionType"],
  "deterministic": true,
  "entry": "index.js",
  "template": {
    "type": "security-review",
    "requiredEvidence": ["threat-model", "security-scan", "review-approval"]
  }
}
```

### 4. Add README

```markdown
# Security Review Template

Pre-configured template for security review decisions.

## Usage

\`\`\`javascript
const decision = createSecurityReview({ 
  id: 'api-gateway',
  autoReview: true 
})
\`\`\`
```

### 5. Validate

```bash
./reach plugins validate plugins/security-review-template
```

## Key Points

- Templates define required evidence types
- Validation is deterministic (sorted outputs)
- Config options control behavior
