/**
 * ReadyLayer Agent Runtime — Core Type System
 *
 * Canonical runtime architecture:
 *   UI → Skill Graph → MCP Runtime → Tool Invocation → Provider Routing → Evaluation → Artifact Output → Report
 *
 * Execution modes: browser | edge | mcp-server | local-cli
 */

// ── Execution Modes ──

export type ExecutionMode = 'browser' | 'edge' | 'mcp-server' | 'local-cli';

export interface ExecutionContext {
  mode: ExecutionMode;
  sessionId: string;
  startedAt: string;
  tenantId?: string;
  env: Record<string, string>;
}

// ── Skills ──

export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  inputs: SkillInput[];
  tools: string[];
  modelHints: ModelHint[];
  evaluationHooks: string[];
  tags: string[];
}

export interface SkillInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'file';
  required: boolean;
  description: string;
  default?: string | number | boolean;
}

export interface ModelHint {
  provider: string;
  model: string;
  reason: string;
}

export interface SkillComposition {
  id: string;
  name: string;
  skills: string[];
  connections: Array<{ from: string; to: string }>;
}

// ── Tools ──

export type ToolType = 'http' | 'github' | 'file' | 'webhook' | 'local-cli' | 'vector-db';

export interface ToolDefinition {
  id: string;
  name: string;
  type: ToolType;
  description: string;
  permissions: ToolPermission[];
  scope: ToolScope;
  config: Record<string, unknown>;
  boundSkills: string[];
}

export interface ToolPermission {
  action: 'read' | 'write' | 'execute' | 'network';
  resource: string;
  granted: boolean;
}

export interface ToolScope {
  tenantId?: string;
  projectId?: string;
  global: boolean;
}

export interface ToolInvocation {
  toolId: string;
  toolName: string;
  type: ToolType;
  input: Record<string, unknown>;
  output: unknown;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: 'success' | 'error' | 'timeout';
  error?: string;
}

// ── Providers ──

export interface ProviderConfig {
  id: string;
  name: string;
  type: 'openrouter' | 'anthropic' | 'openai' | 'custom';
  isDefault: boolean;
  models: ProviderModel[];
  fallbackProviderId?: string;
  costWeight: number;
  latencyWeight: number;
}

export interface ProviderModel {
  id: string;
  name: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  avgLatencyMs: number;
}

export interface ProviderRoutingResult {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  reason: 'default' | 'cost-optimized' | 'latency-optimized' | 'fallback';
  attemptNumber: number;
}

// ── Execution Graph ──

export interface ExecutionGraph {
  runId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  mode: ExecutionMode;
  startedAt: string;
  completedAt?: string;
  totalDurationMs: number;
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
  provider: ProviderRoutingResult;
  tokenUsage: TokenUsage;
  toolInvocations: ToolInvocation[];
  evaluation?: EvaluationSummary;
}

export interface ExecutionNode {
  id: string;
  type: 'skill' | 'tool' | 'provider' | 'evaluation' | 'input' | 'output';
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionEdge {
  from: string;
  to: string;
  label?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface EvaluationSummary {
  score: number;
  checksRun: number;
  checksPassed: number;
  findings: EvaluationFinding[];
}

export interface EvaluationFinding {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  detail: string;
  fix: string;
}

// ── Artifacts ──

export type ArtifactFormat = 'json' | 'mcp-config' | 'cli-command' | 'report';

export interface RunArtifact {
  runId: string;
  format: ArtifactFormat;
  content: string;
  generatedAt: string;
  shareUrl?: string;
}

// ── MCP Export ──

export interface MCPServerConfig {
  name: string;
  version: string;
  tools: MCPToolSpec[];
  resources: MCPResource[];
}

export interface MCPToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  mimeType: string;
}
