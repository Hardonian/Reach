# Config-as-Code Snapshots

## Overview

Reach supports exporting and importing system configuration as versioned JSON snapshots. This enables:

- **Reproducible environments** — spin up identical configs across dev/staging/prod
- **Audit trail** — every config change can be tracked via snapshot diffs
- **Disaster recovery** — restore known-good configs quickly

## Snapshot Format (v1.0.0)

```json
{
  "version": "1.0.0",
  "exportedAt": "2026-02-21T00:00:00.000Z",
  "exportedBy": "user@example.com",
  "tenantId": "tenant_abc",
  "evaluation": { "weights": {}, "defaultThreshold": 0.8, "autoRunOnDeploy": false },
  "modelDefaults": { "primaryModel": "gpt-4-turbo", "fallbackModel": "gpt-3.5-turbo", "maxTokensCap": 4096, "temperatureDefault": 0.7, "circuitBreaker": { "enabled": true, "failureThreshold": 5, "resetTimeoutMs": 30000 } },
  "runnerSchedules": [],
  "governance": { "requireApprovalForDeploy": false, "enforceRetentionPolicies": true, "auditLogRetentionDays": 90, "safetyGatesEnabled": true },
  "datasetIndexing": { "chunkSize": 512, "chunkOverlap": 50, "embeddingModel": "text-embedding-3-small" },
  "integrations": [],
  "retention": { "defaultRetentionDays": 30, "tiers": [...] }
}
```

**Security:** Snapshots NEVER include secrets (API keys, tokens, passwords).

## Workflow

1. Navigate to `/console/governance/config-as-code`
2. **Export** the current config as JSON
3. Edit the JSON as needed (version control recommended)
4. **Import** the modified JSON — a diff preview is shown
5. Review the diff and **Apply**

## Schema Validation

All imports are validated against a Zod schema (`lib/config-snapshot/schema.ts`). Invalid snapshots are rejected with clear error messages.

## Storage

Currently snapshots are stored in browser localStorage. Backend persistence will use the existing API layer when available.
