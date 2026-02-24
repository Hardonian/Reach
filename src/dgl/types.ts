export type DglViolationType =
  | "terminology"
  | "intent"
  | "semantic"
  | "trust_boundary"
  | "api_contract"
  | "dependency_graph"
  | "memory_context"
  | "openapi"
  | "performance"
  | "agent_contract";

export interface DglViolation {
  type: DglViolationType;
  severity: "info" | "warn" | "error";
  paths: string[];
  evidence: string;
  suggested_fix: string;
  line?: number;
}

export interface AgentContract {
  provider: string;
  model: string;
  agent_id: string;
  task_class: "refactor" | "bugfix" | "docs" | "security" | "perf" | "ui" | "infra";
  changed_paths: string[];
  risk_summary: string;
  confidence: number;
  claimed_invariants_changed: string[];
  requires_acknowledgement: boolean;
  context_hash?: string;
}

export interface DglReport {
  schema_version: "1.1.0";
  run_id: string;
  timestamp: string;
  repo: string;
  base_sha: string;
  head_sha: string;
  provider?: { provider?: string; model?: string; agent_id?: string; context_hash?: string };
  context_hash?: string;
  blast_radius?: {
    score: number;
    subsystems_touched: number;
    dependency_depth_impacted: number;
    public_api_surface_affected: number;
    openapi_endpoints_touched: number;
    bundle_sensitive_files_touched: number;
  };
  economics?: {
    tokens_consumed: number;
    diff_size: number;
    passes_to_converge: number;
    repair_cycles: number;
    cost_per_accepted_change: number;
  };
  drift_forecast_score?: number;
  summary: {
    intent_alignment_score: number;
    terminology_drift_score: number;
    semantic_drift_score: number;
    trust_boundary_change_score: number;
    calibration_score: number;
    blast_radius_score?: number;
  };
  timings_ms?: {
    language_scan: number;
    intent: number;
    openapi: number;
    semantic: number;
    trust_boundary: number;
    report_write: number;
  };
  openapi_compat_summary?: {
    scanned_specs: string[];
    breaking: number;
    warnings: number;
  };
  violations: DglViolation[];
  provider_matrix?: Array<{ provider: string; model: string; pass_rate: number; revert_ratio: number; calibration_score: number }>;
  turbulence_hotspots: Array<{ path: string; reason: string; count: number }>;
}
