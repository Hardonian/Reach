export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  deleted_at: string | null;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  deleted_at: string | null;
}

export type Role = "owner" | "admin" | "member" | "viewer";

export interface WebSession {
  id: string;
  user_id: string;
  tenant_id: string | null;
  expires_at: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  tenant_id: string;
  user_id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  created_at: string;
  deleted_at: string | null;
}

export interface Workflow {
  id: string;
  tenant_id: string;
  project_id: string | null;
  name: string;
  description: string;
  graph_json: string;
  version: number;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WorkflowRun {
  id: string;
  tenant_id: string;
  workflow_id: string;
  status: string;
  inputs_json: string;
  outputs_json: string;
  metrics_json: string;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface Pack {
  id: string;
  tenant_id: string | null;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  category: string;
  visibility: string;
  latest_version: string;
  author_id: string | null;
  author_name: string;
  verified: number;
  security_status: string;
  reputation_score: number;
  downloads: number;
  rating_sum: number;
  rating_count: number;
  tools_json: string;
  tags_json: string;
  permissions_json: string;
  data_handling: string;
  flagged: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PackVersion {
  id: string;
  pack_id: string;
  version: string;
  manifest_json: string;
  readme: string;
  changelog: string;
  immutable: number;
  published_at: string;
}

export interface Entitlement {
  id: string;
  tenant_id: string;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string;
  runs_per_month: number;
  runs_used_this_month: number;
  pack_limit: number;
  retention_days: number;
  period_start: string | null;
  period_end: string | null;
  updated_at: string;
}

export interface AuditEvent {
  id: number;
  tenant_id: string;
  user_id: string | null;
  action: string;
  resource: string;
  resource_id: string;
  metadata_json: string;
  ip_address: string | null;
  created_at: string;
}

export interface Gate {
  id: string;
  tenant_id: string;
  name: string;
  repo_provider: string;
  repo_owner: string;
  repo_name: string;
  default_branch: string;
  trigger_types: string[];
  required_checks: GateCheck[];
  thresholds: GateThresholds;
  status: "enabled" | "disabled";
  created_at: string;
  updated_at: string;
}
export interface GateCheck {
  type: "template" | "rule" | "scenario";
  ref_id: string;
  name: string;
}
export interface GateThresholds {
  pass_rate: number;
  max_violations: number;
}

export interface GateRun {
  id: string;
  tenant_id: string;
  gate_id: string;
  workflow_run_id: string | null;
  status: "running" | "passed" | "failed";
  trigger_type: string;
  commit_sha: string | null;
  pr_number: number | null;
  branch: string | null;
  report: GateReport;
  github_check_run_id: number | null;
  created_at: string;
  finished_at: string | null;
}
export interface GateFinding {
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  fix: string;
}
export interface GateReport {
  verdict: "passed" | "failed";
  pass_rate: number;
  violations: number;
  findings: GateFinding[];
  summary: string;
  report_url?: string;
}

export interface GithubInstallation {
  id: string;
  tenant_id: string;
  installation_id: number | null;
  access_token: string | null;
  token_expires_at: string | null;
  repo_owner: string;
  repo_name: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Decision Pillar Types
// ============================================================================

/**
 * Decision Report Status
 */
export type DecisionStatus =
  | "draft"
  | "evaluated"
  | "reviewed"
  | "accepted"
  | "rejected"
  | "superseded";

/**
 * Decision Outcome Status
 */
export type DecisionOutcomeStatus = "unknown" | "success" | "failure" | "mixed";

/**
 * Source Type for Decision
 */
export type DecisionSourceType = "diff" | "drift" | "policy" | "trust" | "manual";

/**
 * Decision Report - Core entity for the Decision Pillar
 */
export interface DecisionReport {
  id: string;
  created_at: string;
  updated_at: string;

  // Scope
  workspace_id: string | null;
  project_id: string | null;

  // Source
  source_type: DecisionSourceType;
  source_ref: string;

  // Fingerprint (deterministic hash of input)
  input_fingerprint: string;

  // Decision data (JSON)
  decision_input: string; // JSON serialized DecisionInput
  decision_output: string | null; // JSON serialized DecisionResult
  decision_trace: string | null; // JSON array of trace strings

  // Recommendation
  recommended_action_id: string | null;

  // Status lifecycle
  status: DecisionStatus;

  // Outcome tracking
  outcome_status: DecisionOutcomeStatus;
  outcome_notes: string | null;
  outcome_timestamp: string | null;

  // Calibration (for future weight tuning)
  calibration_delta: number | null;
  predicted_score: number | null;
  actual_score: number | null;

  // Governance
  governance_badges: string | null; // JSON array

  // Soft delete
  deleted_at: string | null;
}

/**
 * Junction - Triggered decision events
 */
export interface Junction {
  id: string;
  created_at: string;

  // Junction type
  type: "diff_critical" | "drift_alert" | "trust_drop" | "policy_violation";

  // Severity score 0..1
  severity_score: number;

  // Fingerprint for deduplication (deterministic)
  fingerprint: string;

  // Trigger data
  trigger_source_ref: string;
  trigger_data: string; // JSON
  trigger_trace: string; // JSON array explaining why fired

  // Status
  status: "triggered" | "acknowledged" | "resolved" | "superseded";

  // Reference to decision (if evaluated)
  decision_id: string | null;

  // Deduplication
  cooldown_until: string | null;
  superseded_by: string | null;

  // Soft delete
  deleted_at: string | null;
}

/**
 * Action Intent - Logged when user accepts a decision
 */
export interface ActionIntent {
  id: string;
  created_at: string;

  // Reference
  decision_id: string;
  action_id: string;

  // Status
  status: "pending" | "executed" | "cancelled" | "failed";

  // Details
  notes: string | null;
  executed_at: string | null;
}

export interface CiIngestRun {
  id: string;
  tenant_id: string;
  workspace_key: string | null;
  commit_sha: string | null;
  branch: string | null;
  pr_number: number | null;
  actor: string | null;
  ci_provider: string;
  artifacts: Record<string, unknown>;
  run_metadata: Record<string, unknown>;
  gate_run_id: string | null;
  status: string;
  created_at: string;
}

export type SignalType =
  | "drift"
  | "latency"
  | "policy_violation"
  | "tool_failure"
  | "regression_rate";
export interface Signal {
  id: string;
  tenant_id: string;
  name: string;
  type: SignalType;
  source: "webhook" | "poller";
  threshold: Record<string, unknown>;
  status: "enabled" | "disabled";
  created_at: string;
  updated_at: string;
}

export interface MonitorRun {
  id: string;
  tenant_id: string;
  signal_id: string;
  value: number;
  metadata: Record<string, unknown>;
  alert_triggered: boolean;
  created_at: string;
}

export interface AlertRule {
  id: string;
  tenant_id: string;
  signal_id: string | null;
  name: string;
  channel: "email" | "webhook";
  destination: string;
  status: "enabled" | "disabled";
  created_at: string;
  updated_at: string;
}

export interface ScenarioVariant {
  id: string;
  label: string;
  prompt_override?: string;
  model?: string;
  provider?: string;
  temperature?: number;
  top_p?: number;
  disable_tools?: string[];
  inject_latency_ms?: number;
}

export interface Scenario {
  id: string;
  tenant_id: string;
  name: string;
  base_run_id: string | null;
  variants: ScenarioVariant[];
  compare_metrics: string[];
  created_at: string;
  updated_at: string;
}

export interface ScenarioVariantResult {
  variant_id: string;
  variant_label: string;
  status: "passed" | "failed" | "error";
  latency_ms: number;
  pass_rate: number;
  cost_usd: number;
  error?: string;
  outputs?: unknown;
}

export interface ScenarioRun {
  id: string;
  tenant_id: string;
  scenario_id: string;
  status: "running" | "completed" | "failed";
  results: ScenarioVariantResult[];
  recommendation: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface ReportShare {
  id: string;
  tenant_id: string;
  resource_type: string;
  resource_id: string;
  slug: string;
  expires_at: string | null;
  created_at: string;
}
