# Junction Rule Pack

Collection of reusable junction rules for common decision patterns.

## Capabilities

- `registerPolicy` - Registers 5 common policy rules

## Rules

### min-evidence

Requires minimum number of evidence items.

```javascript
{ "policy": "min-evidence", "options": { "min": 3 } }
```

### required-types

Requires specific evidence types to be present.

```javascript
{ "policy": "required-types", "options": { "types": ["threat-model", "review"] } }
```

### block-high-risk

Blocks decisions with high-risk evidence.

```javascript
{ "policy": "block-high-risk", "options": { "riskLevels": ["high", "critical"] } }
```

### require-signatures

Requires all evidence to be cryptographically signed.

```javascript
{ "policy": "require-signatures" }
```

### check-expiration

Expires decisions older than specified age.

```javascript
{ "policy": "check-expiration", "options": { "maxAgeMs": 86400000 } }
```

## Usage

```javascript
{
  "policies": [
    { "name": "min-evidence", "options": { "min": 2 } },
    { "name": "block-high-risk" }
  ]
}
```

## Determinism

- All outputs sorted alphabetically
- No external state
- Reference time passed as parameter
- Pure functions only
