/**
 * @zeo/contracts - Shared type definitions for the Reach/Zeo ecosystem
 */

// Dashboard Persona Types
export type DashboardPersona = "exec" | "eng" | "sec" | "ops";

// Dashboard Graph Node
export interface DashboardGraphNode {
  id: string;
  type: "decision" | "evidence" | "policy" | "assumption" | "outcome";
  label: string;
  severity: number;
  meta?: Record<string, unknown>;
}

// Dashboard Graph Edge
export interface DashboardGraphEdge {
  from: string;
  to: string;
  type: "supports" | "violates" | "constrains" | "depends_on";
  weight: number;
}

// Dashboard Verification Status
export interface DashboardVerificationStatus {
  verified: boolean;
  reason: string;
}

// Dashboard Fingerprint
export interface DashboardFingerprint {
  zeoVersion: string;
  configHash: string;
  policyHash: string | null;
  inputsHash: string;
  artifactsHash: string;
}

// Dashboard Summary
export interface DashboardSummary {
  riskScore: number;
  evidenceCompleteness: number;
  policyCompliance: number;
  replayStability: number;
  confidenceBand: "low" | "med" | "high";
}

// Dashboard Story
export interface DashboardStory {
  mode: string;
  statusLine: string;
  changeLine: string;
  causeLine: string;
  actionLine: string;
}

// Dashboard Trend Point
export interface DashboardTrendPoint {
  t: string;
  v: number;
  source?: string;
}

// Dashboard Drift Event
export interface DashboardDriftEvent {
  t: string;
  type: "policy" | "evidence";
  severity: 1 | 2 | 3 | 4 | 5;
  refId: string;
}

// Dashboard Assumption Flip
export interface DashboardAssumptionFlip {
  t: string;
  assumptionId: string;
  from: string;
  to: string;
  severity: 1 | 2 | 3 | 4 | 5;
}

// Dashboard Trends
export interface DashboardTrends {
  riskTrajectory: DashboardTrendPoint[];
  driftEvents: DashboardDriftEvent[];
  assumptionFlips: DashboardAssumptionFlip[];
}

// Dashboard Graph
export interface DashboardGraph {
  nodes: DashboardGraphNode[];
  edges: DashboardGraphEdge[];
}

// Dashboard Finding
export interface DashboardFinding {
  id: string;
  category: string;
  severity: number;
  title: string;
  file?: string;
  rationaleRefs: string[];
}

// Dashboard Evidence
export interface DashboardEvidence {
  id: string;
  qualityScore: number;
  freshness: "fresh" | "aging" | "stale";
  ageDays: number;
  expiresAt?: string;
}

// Dashboard Policy
export interface DashboardPolicy {
  id: string;
  status: "pass" | "warn" | "fail";
  severity: number;
  rationaleRefs: string[];
}

// Dashboard Lists
export interface DashboardLists {
  findings: DashboardFinding[];
  evidence: DashboardEvidence[];
  policies: DashboardPolicy[];
}

// Dashboard CTA
export interface DashboardCta {
  id: string;
  label: string;
  action: string;
  priority: "high" | "medium" | "low";
  target?: string;
}

// Dashboard View Model
export interface DashboardViewModel {
  schemaVersion: string;
  id: string;
  generatedAt: string;
  persona: DashboardPersona;
  verificationStatus: DashboardVerificationStatus;
  fingerprint: DashboardFingerprint;
  summary: DashboardSummary;
  story: DashboardStory;
  trends: DashboardTrends;
  graph: DashboardGraph;
  nodes?: DashboardGraphNode[];
  edges?: DashboardGraphEdge[];
  lists: DashboardLists;
  ctas: DashboardCta[];
}


// Zeolite Decision Types
export interface DecisionAgent {
  id: string;
  name: string;
  role: string;
}

export interface DecisionAction {
  id: string;
  label: string;
  actorId: string;
  kind: string;
}

export interface DecisionAssumption {
  id: string;
  text: string;
  status: string;
  confidence: string;
  tags: string[];
}

export interface DecisionConstraint {
  id: string;
  name: string;
  value: string;
  status: string;
}

export interface DecisionObjective {
  id: string;
  metric: string;
  weight: number;
}

export interface DecisionSpec {
  id: string;
  title: string;
  context: string;
  createdAt: string;
  horizon: string;
  agents: DecisionAgent[];
  actions: DecisionAction[];
  constraints: DecisionConstraint[];
  assumptions: DecisionAssumption[];
  objectives: DecisionObjective[];
}

export interface EvidenceEvent {
  id?: string;
  type?: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
  source?: string;
  [key: string]: unknown;
}

export interface FinalizedDecisionTranscript {
  transcript_id?: string;
  transcript_hash?: string;
  [key: string]: unknown;
}
