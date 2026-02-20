/**
 * Reach Cloud — Zod validation schemas for all API inputs.
 */
import { z } from 'zod';

// ── Auth ──────────────────────────────────────────────────────────────────
export const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(100),
  tenantName: z.string().min(1).max(100),
  tenantSlug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
});

// ── Tenants ───────────────────────────────────────────────────────────────
export const CreateTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
});

// ── Projects ──────────────────────────────────────────────────────────────
export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
});

// ── Workflows ─────────────────────────────────────────────────────────────
const NodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['trigger', 'agent', 'rag_query', 'tool_call', 'validation', 'branch', 'planner', 'output']),
  name: z.string().min(1),
  inputs: z.record(z.string(), z.unknown()).default({}),
  config: z.record(z.string(), z.unknown()).default({}),
  outputs: z.record(z.string(), z.unknown()).default({}),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

const EdgeSchema = z.object({
  id: z.string().optional(),
  from: z.string().min(1),
  to: z.string().min(1),
  mapping: z.record(z.string(), z.string()).optional(),
});

const TriggerSchema = z.object({
  type: z.enum(['manual', 'webhook', 'schedule']),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const GraphSchema = z.object({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  triggers: z.array(TriggerSchema).default([{ type: 'manual' }]),
  policies: z.array(z.string()).default([]),
  version: z.number().int().min(1).default(1),
});

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  projectId: z.string().optional(),
  graph: GraphSchema.optional(),
});

export const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  graph: GraphSchema.optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

export const RunWorkflowSchema = z.object({
  inputs: z.record(z.string(), z.unknown()).default({}),
});

// ── API Keys ──────────────────────────────────────────────────────────────
export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default(['*']),
});

// ── Packs / Marketplace ───────────────────────────────────────────────────
export const PackManifestSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().min(10).max(2000),
  shortDescription: z.string().max(200).default(''),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver (x.y.z)'),
  category: z.enum(['research', 'data', 'development', 'productivity', 'marketing', 'security', 'automation', 'general']),
  visibility: z.enum(['public', 'org-private', 'unlisted']).default('public'),
  tools: z.array(z.string()).default([]),
  tags: z.array(z.string()).max(10).default([]),
  permissions: z.array(z.string()).default([]),
  dataHandling: z.enum(['minimal', 'processed', 'significant']).default('minimal'),
  changelog: z.string().max(2000).default(''),
  readme: z.string().max(50000).default(''),
  authorName: z.string().min(1).max(100),
});

export const BrowsePacksSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  sort: z.enum(['relevance', 'newest', 'trending', 'rating', 'reputation']).optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

export const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).default(''),
});

export const ReportSchema = z.object({
  reason: z.enum(['security', 'spam', 'policy_violation', 'malicious', 'other']),
  details: z.string().max(2000).default(''),
});

// ── Billing ───────────────────────────────────────────────────────────────
export const CheckoutSchema = z.object({
  priceId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

// ── Response helpers ──────────────────────────────────────────────────────
export interface ParseError { errors: z.ZodError; firstMessage: string }

export function parseBody<T>(schema: z.ZodSchema<T>, data: unknown): { data: T } | ParseError {
  const result = schema.safeParse(data);
  if (!result.success) {
    const err = result.error;
    const firstMessage = (err.issues?.[0]?.message) ?? 'Invalid input';
    return { errors: err, firstMessage };
  }
  return { data: result.data };
}
