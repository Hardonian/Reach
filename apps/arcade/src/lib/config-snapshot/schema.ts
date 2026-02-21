import { z } from 'zod';

/**
 * Config-as-Code Snapshot Schema (v1)
 *
 * Versioned schema for exporting/importing system configuration.
 * NEVER includes secrets (API keys, tokens, passwords).
 */

export const SNAPSHOT_VERSION = '1.0.0' as const;

const evaluationConfigSchema = z.object({
  weights: z.record(z.string(), z.number()).default({}),
  defaultThreshold: z.number().min(0).max(1).default(0.8),
  autoRunOnDeploy: z.boolean().default(false),
});

const modelDefaultsSchema = z.object({
  primaryModel: z.string().default('gpt-4-turbo'),
  fallbackModel: z.string().default('gpt-3.5-turbo'),
  maxTokensCap: z.number().int().positive().default(4096),
  temperatureDefault: z.number().min(0).max(2).default(0.7),
  circuitBreaker: z.object({
    enabled: z.boolean().default(true),
    failureThreshold: z.number().int().positive().default(5),
    resetTimeoutMs: z.number().int().positive().default(30000),
  }).default(() => ({ enabled: true, failureThreshold: 5, resetTimeoutMs: 30000 })),
});

const runnerScheduleSchema = z.object({
  id: z.string(),
  cronExpression: z.string().default(''),
  enabled: z.boolean().default(true),
  concurrencyLimit: z.number().int().positive().default(5),
});

const governanceToggleSchema = z.object({
  requireApprovalForDeploy: z.boolean().default(false),
  enforceRetentionPolicies: z.boolean().default(true),
  auditLogRetentionDays: z.number().int().positive().default(90),
  safetyGatesEnabled: z.boolean().default(true),
});

const datasetIndexingSchema = z.object({
  chunkSize: z.number().int().positive().default(512),
  chunkOverlap: z.number().int().min(0).default(50),
  embeddingModel: z.string().default('text-embedding-3-small'),
});

const integrationStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  lastHealthCheck: z.string().nullable().default(null),
  // NEVER includes secrets
});

const retentionPolicySchema = z.object({
  defaultRetentionDays: z.number().int().positive().default(30),
  tiers: z.array(z.object({
    name: z.string(),
    retentionDays: z.number().int().positive(),
    description: z.string().default(''),
  })).default([
    { name: 'short', retentionDays: 7, description: 'Ephemeral artifacts' },
    { name: 'standard', retentionDays: 30, description: 'Default retention' },
    { name: 'extended', retentionDays: 90, description: 'Compliance-grade retention' },
  ]),
});

export const configSnapshotSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  tenantId: z.string().optional(),

  evaluation: evaluationConfigSchema.default(() => ({ weights: {}, defaultThreshold: 0.8, autoRunOnDeploy: false })),
  modelDefaults: modelDefaultsSchema.default(() => ({
    primaryModel: 'gpt-4-turbo', fallbackModel: 'gpt-3.5-turbo', maxTokensCap: 4096,
    temperatureDefault: 0.7, circuitBreaker: { enabled: true, failureThreshold: 5, resetTimeoutMs: 30000 },
  })),
  runnerSchedules: z.array(runnerScheduleSchema).default([]),
  governance: governanceToggleSchema.default(() => ({
    requireApprovalForDeploy: false, enforceRetentionPolicies: true, auditLogRetentionDays: 90, safetyGatesEnabled: true,
  })),
  datasetIndexing: datasetIndexingSchema.default(() => ({ chunkSize: 512, chunkOverlap: 50, embeddingModel: 'text-embedding-3-small' })),
  integrations: z.array(integrationStateSchema).default([]),
  retention: retentionPolicySchema.default(() => ({
    defaultRetentionDays: 30,
    tiers: [
      { name: 'short', retentionDays: 7, description: 'Ephemeral artifacts' },
      { name: 'standard', retentionDays: 30, description: 'Default retention' },
      { name: 'extended', retentionDays: 90, description: 'Compliance-grade retention' },
    ],
  })),
});

export type ConfigSnapshot = z.infer<typeof configSnapshotSchema>;

/**
 * Validates a raw JSON object against the snapshot schema.
 * Returns { success: true, data } or { success: false, error }.
 */
export function validateSnapshot(raw: unknown): { success: true; data: ConfigSnapshot } | { success: false; error: string } {
  const result = configSnapshotSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') };
}

/**
 * Creates a default snapshot with current timestamp.
 */
export function createDefaultSnapshot(tenantId?: string, exportedBy?: string): ConfigSnapshot {
  return configSnapshotSchema.parse({
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy,
    tenantId,
  });
}

/**
 * Computes a shallow diff between two snapshots.
 * Returns an array of changed paths with old/new values.
 */
export interface SnapshotDiff {
  path: string;
  oldValue: unknown;
  newValue: unknown;
}

export function diffSnapshots(a: ConfigSnapshot, b: ConfigSnapshot): SnapshotDiff[] {
  const diffs: SnapshotDiff[] = [];

  function compare(pathPrefix: string, valA: unknown, valB: unknown) {
    if (valA === valB) return;
    if (typeof valA !== typeof valB || valA === null || valB === null) {
      diffs.push({ path: pathPrefix, oldValue: valA, newValue: valB });
      return;
    }
    if (Array.isArray(valA) && Array.isArray(valB)) {
      if (JSON.stringify(valA) !== JSON.stringify(valB)) {
        diffs.push({ path: pathPrefix, oldValue: valA, newValue: valB });
      }
      return;
    }
    if (typeof valA === 'object' && typeof valB === 'object') {
      const keysA = Object.keys(valA as Record<string, unknown>);
      const keysB = Object.keys(valB as Record<string, unknown>);
      const allKeys = new Set([...keysA, ...keysB]);
      for (const key of allKeys) {
        compare(
          pathPrefix ? `${pathPrefix}.${key}` : key,
          (valA as Record<string, unknown>)[key],
          (valB as Record<string, unknown>)[key],
        );
      }
      return;
    }
    diffs.push({ path: pathPrefix, oldValue: valA, newValue: valB });
  }

  compare('', a, b);
  return diffs;
}
