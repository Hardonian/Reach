export type GovernanceScope = "global" | "repo" | "project";

export type GovernanceMemoryType =
  | "policy_preference"
  | "risk_pattern"
  | "eval_baseline"
  | "cost_model";

export interface GovernanceMemoryEntry {
  id?: string;
  orgId: string;
  workspaceId: string;
  scope: GovernanceScope;
  memoryType: GovernanceMemoryType;
  content: Record<string, unknown>;
  confidence: number;
  createdAt?: string;
  updatedAt?: string;
}

export type RolloutMode = "dry-run" | "enforced";

export type ThresholdOperator = ">=" | "<=" | ">" | "<";

export interface EvalThreshold {
  id: string;
  metric: string;
  operator: ThresholdOperator;
  value: number;
  source: "intent" | "memory" | "default";
}

export interface GateConfig {
  id: string;
  name: string;
  description: string;
  gateType:
    | "eval-threshold"
    | "model-risk"
    | "provenance"
    | "replay"
    | "ci-enforcement";
  action: "warn" | "block";
  conditions: Record<string, unknown>;
}

export interface ReplayPolicy {
  required: boolean;
  mode: "strict" | "sampled";
  retentionDays: number;
}

export interface ProvenancePolicy {
  required: boolean;
  level: "artifact" | "workflow" | "full";
}

export type GovernanceSpec = {
  gates: GateConfig[];
  thresholds: EvalThreshold[];
  replayPolicy?: ReplayPolicy;
  provenancePolicy?: ProvenancePolicy;
  rolloutMode: "dry-run" | "enforced";
};

export interface CIEnforcementRule {
  workflowPath: string;
  failOnViolation: boolean;
  emitArtifactLinks: boolean;
  verifyCommand: string;
}

export interface GovernancePlan {
  summary: string;
  intents: string[];
  rationale: string[];
  memorySignals: string[];
}

export interface GovernanceImpactPreview {
  wouldFailToday: string[];
  affectedRepos: string[];
  costDeltaPct: number;
  evalDeltaPct: number;
}

export interface ExplainabilityPayload {
  sourceIntent: string;
  generatedSpec: GovernanceSpec;
  determinismHash: string;
  riskImpactSummary: string[];
}

export interface CompileGovernanceIntentInput {
  intent: string;
  orgId: string;
  workspaceId: string;
  scope: GovernanceScope;
  memory: GovernanceMemoryEntry[];
  defaultRolloutMode?: RolloutMode;
  forceRolloutMode?: RolloutMode;
}

export interface CompileGovernanceIntentOutput {
  plan: GovernancePlan;
  spec: GovernanceSpec;
  canonicalSpec: string;
  specHash: string;
  ciEnforcement: CIEnforcementRule[];
  impactPreview: GovernanceImpactPreview;
  explainability: ExplainabilityPayload;
}
