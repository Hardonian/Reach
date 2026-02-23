/**
 * ReadyLayer Schema Hardening Module
 *
 * Provides versioned schemas, integrity verification, and audit trails
 * for production-grade data model enforcement.
 *
 * @module schema-hardening
 */

import { z } from "zod";
import crypto from "crypto";

// ── Versioning Schemas ───────────────────────────────────────────────────────

/**
 * Semantic version schema for versioned entities.
 */
export const SemVerSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/);
export type SemVer = z.infer<typeof SemVerSchema>;

/**
 * Base interface for versioned entities.
 */
export interface VersionedEntity {
  version: SemVer;
  version_history: VersionHistoryEntry[];
}

export interface VersionHistoryEntry {
  version: SemVer;
  changed_at: string;
  changed_by: string;
  change_reason: string;
  snapshot_hash?: string;
}

// ── Audit Trail Schemas ──────────────────────────────────────────────────────

/**
 * Audit metadata for tracking creation and modification.
 */
export const AuditMetadataSchema = z.object({
  created_at: z.string().datetime(),
  created_by: z.string(),
  updated_at: z.string().datetime(),
  updated_by: z.string(),
  deleted_at: z.string().datetime().nullable().default(null),
  deleted_by: z.string().nullable().default(null),
});
export type AuditMetadata = z.infer<typeof AuditMetadataSchema>;

/**
 * Creates audit metadata for a new entity.
 */
export function createAuditMetadata(userId: string): AuditMetadata {
  const now = new Date().toISOString();
  return {
    created_at: now,
    created_by: userId,
    updated_at: now,
    updated_by: userId,
    deleted_at: null,
    deleted_by: null,
  };
}

/**
 * Updates audit metadata for an existing entity.
 */
export function updateAuditMetadata(
  existing: AuditMetadata,
  userId: string,
): AuditMetadata {
  return {
    ...existing,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };
}

// ── Integrity Verification ───────────────────────────────────────────────────

/**
 * Hash algorithm for integrity verification.
 */
export type HashAlgorithm = "sha256" | "sha512";

/**
 * Integrity hash for artifact verification.
 */
export interface IntegrityHash {
  algorithm: HashAlgorithm;
  hash: string;
  computed_at: string;
}

/**
 * Computes an integrity hash for arbitrary content.
 */
export function computeIntegrityHash(
  content: string | Buffer | Record<string, unknown>,
  algorithm: HashAlgorithm = "sha256",
): IntegrityHash {
  const data =
    typeof content === "string"
      ? content
      : Buffer.isBuffer(content)
        ? content
        : JSON.stringify(content);

  const hash = crypto.createHash(algorithm).update(data).digest("hex");

  return {
    algorithm,
    hash,
    computed_at: new Date().toISOString(),
  };
}

/**
 * Verifies content against an integrity hash.
 */
export function verifyIntegrityHash(
  content: string | Buffer | Record<string, unknown>,
  expected: IntegrityHash,
): boolean {
  const computed = computeIntegrityHash(content, expected.algorithm);
  return computed.hash === expected.hash;
}

// ── Immutable Snapshot Layer ─────────────────────────────────────────────────

/**
 * Immutable snapshot for run outputs.
 */
export interface RunOutputSnapshot {
  run_id: string;
  snapshot_version: SemVer;
  outputs_json: string;
  outputs_hash: IntegrityHash;
  metrics_json: string;
  metrics_hash: IntegrityHash;
  tool_calls_json: string;
  tool_calls_hash: IntegrityHash;
  created_at: string;
  immutable: boolean;
}

/**
 * Creates an immutable snapshot from run outputs.
 */
export function createRunOutputSnapshot(
  runId: string,
  outputs: Record<string, unknown>,
  metrics: Record<string, unknown>,
  toolCalls: Array<Record<string, unknown>>,
): RunOutputSnapshot {
  const outputsJson = JSON.stringify(outputs);
  const metricsJson = JSON.stringify(metrics);
  const toolCallsJson = JSON.stringify(toolCalls);

  return {
    run_id: runId,
    snapshot_version: "1.0.0",
    outputs_json: outputsJson,
    outputs_hash: computeIntegrityHash(outputsJson),
    metrics_json: metricsJson,
    metrics_hash: computeIntegrityHash(metricsJson),
    tool_calls_json: toolCallsJson,
    tool_calls_hash: computeIntegrityHash(toolCallsJson),
    created_at: new Date().toISOString(),
    immutable: true,
  };
}

// ── Versioned Entity Schemas ─────────────────────────────────────────────────

/**
 * Versioned Skill schema.
 */
export const VersionedSkillSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  version: SemVerSchema,
  version_history: z
    .array(
      z.object({
        version: SemVerSchema,
        changed_at: z.string().datetime(),
        changed_by: z.string(),
        change_reason: z.string(),
        snapshot_hash: z.string().optional(),
      }),
    )
    .default([]),
  config_json: z.string(),
  config_hash: z.object({
    algorithm: z.enum(["sha256", "sha512"]),
    hash: z.string(),
    computed_at: z.string().datetime(),
  }),
  status: z.enum(["draft", "active", "deprecated", "archived"]),
  created_at: z.string().datetime(),
  created_by: z.string(),
  updated_at: z.string().datetime(),
  updated_by: z.string(),
  deleted_at: z.string().datetime().nullable().default(null),
  deleted_by: z.string().nullable().default(null),
});

/**
 * Versioned Template schema.
 */
export const VersionedTemplateSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  version: SemVerSchema,
  version_history: z
    .array(
      z.object({
        version: SemVerSchema,
        changed_at: z.string().datetime(),
        changed_by: z.string(),
        change_reason: z.string(),
        snapshot_hash: z.string().optional(),
      }),
    )
    .default([]),
  prompt_template: z.string(),
  prompt_hash: z.object({
    algorithm: z.enum(["sha256", "sha512"]),
    hash: z.string(),
    computed_at: z.string().datetime(),
  }),
  variables_json: z.string(),
  status: z.enum(["draft", "active", "deprecated", "archived"]),
  created_at: z.string().datetime(),
  created_by: z.string(),
  updated_at: z.string().datetime(),
  updated_by: z.string(),
  deleted_at: z.string().datetime().nullable().default(null),
  deleted_by: z.string().nullable().default(null),
});

/**
 * Versioned Gate schema with version tracking.
 */
export const VersionedGateSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  name: z.string().min(1).max(200),
  repo_provider: z.string().default("github"),
  repo_owner: z.string(),
  repo_name: z.string(),
  default_branch: z.string().default("main"),
  trigger_types: z.array(z.enum(["pr", "push", "schedule"])),
  required_checks: z.array(
    z.object({
      type: z.enum(["template", "rule", "scenario"]),
      ref_id: z.string(),
      name: z.string(),
    }),
  ),
  thresholds: z.object({
    pass_rate: z.number().min(0).max(1),
    max_violations: z.number().int().min(0),
  }),
  version: SemVerSchema.default("1.0.0"),
  version_history: z
    .array(
      z.object({
        version: SemVerSchema,
        changed_at: z.string().datetime(),
        changed_by: z.string(),
        change_reason: z.string(),
      }),
    )
    .default([]),
  config_hash: z
    .object({
      algorithm: z.enum(["sha256", "sha512"]),
      hash: z.string(),
      computed_at: z.string().datetime(),
    })
    .optional(),
  status: z.enum(["enabled", "disabled"]),
  created_at: z.string().datetime(),
  created_by: z.string(),
  updated_at: z.string().datetime(),
  updated_by: z.string(),
  deleted_at: z.string().datetime().nullable().default(null),
  deleted_by: z.string().nullable().default(null),
});

// ── Tool Audit Trail ─────────────────────────────────────────────────────────

/**
 * Tool execution audit record.
 */
export const ToolAuditRecordSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  run_id: z.string(),
  tool_name: z.string(),
  tool_version: SemVerSchema.optional(),
  invocation_id: z.string(),
  input_hash: z.object({
    algorithm: z.enum(["sha256", "sha512"]),
    hash: z.string(),
    computed_at: z.string().datetime(),
  }),
  output_hash: z
    .object({
      algorithm: z.enum(["sha256", "sha512"]),
      hash: z.string(),
      computed_at: z.string().datetime(),
    })
    .optional(),
  execution_time_ms: z.number().int().min(0),
  status: z.enum(["pending", "success", "error", "timeout", "rate_limited"]),
  error_message: z.string().optional(),
  permission_scope: z.array(z.string()).default([]),
  rate_limit_key: z.string().optional(),
  circuit_breaker_state: z.enum(["closed", "open", "half_open"]).optional(),
  created_at: z.string().datetime(),
});
export type ToolAuditRecord = z.infer<typeof ToolAuditRecordSchema>;

/**
 * Creates a tool audit record.
 */
export function createToolAuditRecord(
  tenantId: string,
  runId: string,
  toolName: string,
  invocationId: string,
  input: Record<string, unknown>,
  permissionScope: string[] = [],
): Omit<
  ToolAuditRecord,
  | "id"
  | "output_hash"
  | "execution_time_ms"
  | "status"
  | "error_message"
  | "rate_limit_key"
  | "circuit_breaker_state"
> {
  return {
    tenant_id: tenantId,
    run_id: runId,
    tool_name: toolName,
    invocation_id: invocationId,
    input_hash: computeIntegrityHash(input),
    permission_scope: permissionScope,
    created_at: new Date().toISOString(),
  };
}

// ── Soft Delete Helpers ──────────────────────────────────────────────────────

/**
 * Soft-deletable entity interface.
 */
export interface SoftDeletable {
  deleted_at: string | null;
  deleted_by: string | null;
}

/**
 * Applies soft delete to an entity.
 */
export function applySoftDelete<T extends SoftDeletable>(
  entity: T,
  deletedBy: string,
): T {
  return {
    ...entity,
    deleted_at: new Date().toISOString(),
    deleted_by: deletedBy,
  };
}

/**
 * Checks if an entity is soft-deleted.
 */
export function isSoftDeleted(entity: SoftDeletable): boolean {
  return entity.deleted_at !== null;
}

/**
 * Restores a soft-deleted entity.
 */
export function restoreSoftDelete<T extends SoftDeletable>(entity: T): T {
  return {
    ...entity,
    deleted_at: null,
    deleted_by: null,
  };
}

// ── Schema Validation Helper ─────────────────────────────────────────────────

/**
 * Validates data against a schema and returns typed result or errors.
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

// ── Migration Helpers ────────────────────────────────────────────────────────

/**
 * Migration record for tracking schema changes.
 */
export const MigrationRecordSchema = z.object({
  version: z.number().int().positive(),
  name: z.string(),
  applied_at: z.string().datetime(),
  checksum: z.string(),
  rollback_sql: z.string().optional(),
});

/**
 * Generates a checksum for migration SQL.
 */
export function generateMigrationChecksum(sql: string): string {
  return crypto.createHash("sha256").update(sql).digest("hex");
}
