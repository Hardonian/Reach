# @zeo/core

Core decision and transcript runtime for Zeo.

## API naming migration

### Background
`@zeo/core` historically exposed a generic `computeTranscriptHash` symbol from the barrel. The core package now exposes explicit names to reduce ambiguity between decision-transcript hashing and canonical/envelope hashing.

### Preferred exports
- `computeDecisionTranscriptHash` — hash for decision transcript payloads from `transcript.ts`.
- `computeSecurityTranscriptHash` — canonical/envelope hash from `transcript-security.ts`.

### Compatibility
`computeTranscriptHash` remains available from the barrel for backward compatibility, but new integrations should migrate to explicit names to make intent and provenance boundaries clear.
