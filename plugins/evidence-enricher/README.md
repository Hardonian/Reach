# Evidence Enricher Plugin

Adds computed metadata to evidence items in a deterministic way.

## Capabilities

- `registerEvidenceExtractor` - Enriches evidence with metadata

## Enriched Fields

| Field        | Description                         |
| ------------ | ----------------------------------- |
| `wordCount`  | Number of words in evidence content |
| `confidence` | Computed confidence score (0.0-1.0) |
| `enrichedAt` | Reference timestamp (deterministic) |

## Confidence Scoring

Confidence is calculated deterministically based on:

- Has source: +0.1
- Has timestamp: +0.1
- Has signatures: +0.2
- Content length > 50: +0.1
- Base: 0.5

## Usage

```javascript
// The plugin automatically enriches evidence during extraction
const enriched = extractEvidence(rawEvidence, {
  options: {
    fields: ["wordCount", "confidence"],
    referenceTime: 0, // deterministic
  },
});
```

## Determinism

- No randomness
- No external state
- Sorted output
- Reference time passed as parameter
