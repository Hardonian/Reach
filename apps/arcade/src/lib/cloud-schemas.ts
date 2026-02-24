/**
 * Reach Cloud — Zod validation schemas for all API inputs.
 */
import { z } from "zod";

// ── Auth ──────────────────────────────────────────────────────────────────
export const LoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const RegisterSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1).max(100),
  tenantName: z.string().min(1).max(100),
  tenantSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
});

// ── Tenants ───────────────────────────────────────────────────────────────
export const CreateTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
});

// ── Projects ──────────────────────────────────────────────────────────────
export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
});

// ── Workflows ─────────────────────────────────────────────────────────────
const NodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "trigger",
    "agent",
    "rag_query",
    "tool_call",
    "validation",
    "branch",
    "planner",
    "output",
  ]),
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
  type: z.enum(["manual", "webhook", "schedule"]),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const GraphSchema = z.object({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  triggers: z.array(TriggerSchema).default([{ type: "manual" }]),
  policies: z.array(z.string()).default([]),
  version: z.number().int().min(1).default(1),
});

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(""),
  projectId: z.string().optional(),
  graph: GraphSchema.optional(),
});

export const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  graph: GraphSchema.optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export const RunWorkflowSchema = z.object({
  inputs: z.record(z.string(), z.unknown()).default({}),
});

// ── API Keys ──────────────────────────────────────────────────────────────
export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default(["*"]),
});

// ── Packs / Marketplace ───────────────────────────────────────────────────
export const PackManifestSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().min(10).max(2000),
  shortDescription: z.string().max(200).default(""),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be semver (x.y.z)"),
  category: z.enum([
    "research",
    "data",
    "development",
    "productivity",
    "marketing",
    "security",
    "automation",
    "general",
  ]),
  visibility: z.enum(["public", "org-private", "unlisted"]).default("public"),
  tools: z.array(z.string()).default([]),
  tags: z.array(z.string()).max(10).default([]),
  permissions: z.array(z.string()).default([]),
  dataHandling: z.enum(["minimal", "processed", "significant"]).default("minimal"),
  changelog: z.string().max(2000).default(""),
  readme: z.string().max(50000).default(""),
  authorName: z.string().min(1).max(100),
});

export const BrowsePacksSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  sort: z.enum(["relevance", "newest", "trending", "rating", "reputation"]).optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

export const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).default(""),
});

export const ReportSchema = z.object({
  reason: z.enum(["security", "spam", "policy_violation", "malicious", "other"]),
  details: z.string().max(2000).default(""),
});

// ── Billing ───────────────────────────────────────────────────────────────
export const CheckoutSchema = z.object({
  priceId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

// ── Gates ─────────────────────────────────────────────────────────────────
const GateCheckSchema = z.object({
  type: z.enum(["template", "rule", "scenario"]),
  ref_id: z.string().min(1),
  name: z.string().min(1),
});

const GateThresholdsSchema = z.object({
  pass_rate: z.number().min(0).max(1).default(1.0),
  max_violations: z.number().int().min(0).default(0),
});

export const CreateGateSchema = z.object({
  name: z.string().min(1).max(200),
  repo_owner: z.string().min(1).max(100),
  repo_name: z.string().min(1).max(100),
  default_branch: z.string().min(1).max(100).default("main"),
  trigger_types: z.array(z.enum(["pr", "push", "schedule"])).default(["pr", "push"]),
  required_checks: z.array(GateCheckSchema).default([]),
  thresholds: GateThresholdsSchema.default({
    pass_rate: 1.0,
    max_violations: 0,
  }),
});

export const UpdateGateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  default_branch: z.string().min(1).max(100).optional(),
  trigger_types: z.array(z.enum(["pr", "push", "schedule"])).optional(),
  required_checks: z.array(GateCheckSchema).optional(),
  thresholds: GateThresholdsSchema.optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
});

export const TriggerGateRunSchema = z.object({
  trigger_type: z.enum(["manual", "pr", "push", "schedule"]).default("manual"),
  commit_sha: z.string().optional(),
  pr_number: z.number().int().optional(),
  branch: z.string().optional(),
});

// ── Governance Assistant ───────────────────────────────────────────────────
export const GovernanceScopeSchema = z.enum(["global", "repo", "project"]);
export const GovernanceRolloutModeSchema = z.enum(["dry-run", "enforced"]);

export const GovernanceAssistantSchema = z.object({
  intent: z.string().min(1).max(5000),
  workspace_id: z.string().min(1).max(120).default("default"),
  scope: GovernanceScopeSchema.default("project"),
  rollout_mode: GovernanceRolloutModeSchema.optional(),
  action: z.enum(["preview", "apply"]).default("preview"),
  preview_spec_hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "preview_spec_hash must be a 64-character hex hash")
    .optional(),
  trigger: z.enum(["assistant", "user"]).default("assistant"),
});

export const GovernanceMemorySchema = z.object({
  workspace_id: z.string().min(1).max(120).default("default"),
  scope: GovernanceScopeSchema.default("project"),
  memory_type: z.enum(["policy_preference", "risk_pattern", "eval_baseline", "cost_model"]),
  content: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1).default(0.8),
});

// ── CI Ingest ─────────────────────────────────────────────────────────────
export const CiIngestSchema = z.object({
  workspace_key: z.string().optional(),
  commit_sha: z.string().optional(),
  branch: z.string().optional(),
  pr_number: z.number().int().optional(),
  actor: z.string().optional(),
  ci_provider: z.enum(["github", "gitlab", "circleci", "jenkins", "other"]).default("github"),
  artifacts: z
    .object({
      prompt_diffs: z.array(z.record(z.string(), z.unknown())).optional(),
      eval_outputs: z.array(z.record(z.string(), z.unknown())).optional(),
      traces: z.array(z.record(z.string(), z.unknown())).optional(),
      policy_violations: z.array(z.record(z.string(), z.unknown())).optional(),
      tool_call_logs: z.array(z.record(z.string(), z.unknown())).optional(),
    })
    .default({}),
  run_metadata: z.record(z.string(), z.unknown()).default({}),
  gate_id: z.string().optional(),
});

// ── Signals ───────────────────────────────────────────────────────────────
export const CreateSignalSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["drift", "latency", "policy_violation", "tool_failure", "regression_rate"]),
  source: z.enum(["webhook", "poller"]).default("webhook"),
  threshold: z.record(z.string(), z.unknown()).default({}),
});

export const UpdateSignalSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  threshold: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
});

// ── Monitor Ingest ────────────────────────────────────────────────────────
export const MonitorIngestSchema = z.object({
  signal_id: z.string().min(1),
  value: z.number(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

// ── Alert Rules ───────────────────────────────────────────────────────────
export const CreateAlertRuleSchema = z.object({
  name: z.string().min(1).max(200),
  signal_id: z.string().optional(),
  channel: z.enum(["email", "webhook"]),
  destination: z.string().min(1).max(500),
});

export const UpdateAlertRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  destination: z.string().min(1).max(500).optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
});

// ── Scenarios ─────────────────────────────────────────────────────────────
const ScenarioVariantSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  prompt_override: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  disable_tools: z.array(z.string()).optional(),
  inject_latency_ms: z.number().int().min(0).optional(),
});

export const CreateScenarioSchema = z.object({
  name: z.string().min(1).max(200),
  base_run_id: z.string().optional(),
  variants: z.array(ScenarioVariantSchema).min(1).max(10),
  compare_metrics: z
    .array(z.enum(["pass_rate", "latency", "cost", "drift"]))
    .default(["pass_rate", "latency", "cost"]),
});

export const UpdateScenarioSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  variants: z.array(ScenarioVariantSchema).optional(),
  compare_metrics: z.array(z.string()).optional(),
});

// ── Report Shares ─────────────────────────────────────────────────────────
export const CreateReportShareSchema = z.object({
  resource_type: z.enum(["gate_run", "scenario_run", "monitor_run"]),
  resource_id: z.string().min(1),
  expires_in_seconds: z.number().int().min(3600).max(2592000).optional(), // 1h to 30d
});

// ── Response helpers ──────────────────────────────────────────────────────
export function parseBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { data: T } | { errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (!result.success) return { errors: result.error };
  return { data: result.data };
}
