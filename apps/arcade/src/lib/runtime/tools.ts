/**
 * ReadyLayer Tool Registry
 *
 * Tool types: http | github | file | webhook | local-cli | vector-db
 * Each tool has permissions, scope, audit trail, and is bindable to skills.
 */

import type { ToolDefinition, ToolType, ToolInvocation } from "./types";

// ── Built-in Tools ──

export const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    id: "trace-parser",
    name: "Trace Parser",
    type: "local-cli",
    description: "Parse agent execution traces into structured timeline data.",
    permissions: [{ action: "read", resource: "traces", granted: true }],
    scope: { global: true },
    config: { format: "opentelemetry" },
    boundSkills: ["readiness-check", "trace-capture", "release-gate"],
  },
  {
    id: "policy-engine",
    name: "Policy Engine",
    type: "local-cli",
    description: "Evaluate tool calls against policy rules and allowlists.",
    permissions: [{ action: "read", resource: "policies", granted: true }],
    scope: { global: true },
    config: { strictMode: false },
    boundSkills: ["readiness-check", "policy-gate", "release-gate"],
  },
  {
    id: "schema-validator",
    name: "Schema Validator",
    type: "local-cli",
    description: "Validate output schemas against baseline definitions.",
    permissions: [{ action: "read", resource: "schemas", granted: true }],
    scope: { global: true },
    config: { dialect: "json-schema-draft-07" },
    boundSkills: ["readiness-check", "regression-detect"],
  },
  {
    id: "diff-engine",
    name: "Diff Engine",
    type: "local-cli",
    description: "Compare runs and produce behavioral diffs.",
    permissions: [{ action: "read", resource: "runs", granted: true }],
    scope: { global: true },
    config: { algorithm: "semantic" },
    boundSkills: ["regression-detect", "release-gate"],
  },
  {
    id: "allowlist-checker",
    name: "Allowlist Checker",
    type: "local-cli",
    description: "Check tool calls against configured allow/block lists.",
    permissions: [{ action: "read", resource: "allowlists", granted: true }],
    scope: { global: true },
    config: {},
    boundSkills: ["policy-gate"],
  },
  {
    id: "stats-calculator",
    name: "Stats Calculator",
    type: "local-cli",
    description: "Compute p50/p95/p99 latency and statistical comparisons.",
    permissions: [{ action: "read", resource: "metrics", granted: true }],
    scope: { global: true },
    config: { percentiles: [50, 95, 99] },
    boundSkills: ["regression-detect"],
  },
  {
    id: "timeline-builder",
    name: "Timeline Builder",
    type: "local-cli",
    description: "Build visual timeline from execution trace data.",
    permissions: [{ action: "read", resource: "traces", granted: true }],
    scope: { global: true },
    config: {},
    boundSkills: ["trace-capture"],
  },
  {
    id: "ci-reporter",
    name: "CI Reporter",
    type: "webhook",
    description: "Post results to CI/CD systems (GitHub Actions, GitLab CI).",
    permissions: [
      { action: "network", resource: "ci-endpoints", granted: true },
      { action: "write", resource: "check-runs", granted: true },
    ],
    scope: { global: true },
    config: { format: "github-check-run" },
    boundSkills: ["release-gate"],
  },
  {
    id: "mcp-client",
    name: "MCP Client",
    type: "http",
    description: "Connect to MCP servers and discover available tools.",
    permissions: [
      { action: "network", resource: "mcp-servers", granted: true },
    ],
    scope: { global: true },
    config: { timeout: 5000 },
    boundSkills: ["mcp-bridge"],
  },
  {
    id: "tool-discovery",
    name: "Tool Discovery",
    type: "http",
    description: "Discover and register tools from external sources.",
    permissions: [{ action: "network", resource: "registries", granted: true }],
    scope: { global: true },
    config: {},
    boundSkills: ["mcp-bridge"],
  },
  {
    id: "github-integration",
    name: "GitHub Integration",
    type: "github",
    description: "Read repos, PRs, and issues. Post check run results.",
    permissions: [
      { action: "read", resource: "repos", granted: true },
      { action: "write", resource: "check-runs", granted: true },
    ],
    scope: { global: true },
    config: {},
    boundSkills: [],
  },
  {
    id: "vector-search",
    name: "Vector Search",
    type: "vector-db",
    description: "Semantic search across indexed agent traces and artifacts.",
    permissions: [{ action: "read", resource: "vectors", granted: true }],
    scope: { global: true },
    config: { dimensions: 1536, metric: "cosine" },
    boundSkills: [],
  },
];

// ── Registry Operations ──

export function getTool(id: string): ToolDefinition | undefined {
  return BUILTIN_TOOLS.find((t) => t.id === id);
}

export function getToolsByType(type: ToolType): ToolDefinition[] {
  return BUILTIN_TOOLS.filter((t) => t.type === type);
}

export function getToolsForSkill(skillId: string): ToolDefinition[] {
  return BUILTIN_TOOLS.filter((t) => t.boundSkills.includes(skillId));
}

export function getAllTools(): ToolDefinition[] {
  return [...BUILTIN_TOOLS];
}

// ── Tool Invocation ──

export function createInvocation(
  tool: ToolDefinition,
  input: Record<string, unknown>,
): Omit<
  ToolInvocation,
  "output" | "completedAt" | "durationMs" | "status" | "error"
> {
  return {
    toolId: tool.id,
    toolName: tool.name,
    type: tool.type,
    input,
    startedAt: new Date().toISOString(),
  };
}

// ── Tool Type Metadata ──

export const TOOL_TYPE_META: Record<
  ToolType,
  { label: string; icon: string; color: string }
> = {
  http: { label: "HTTP", icon: "🌐", color: "#3B82F6" },
  github: { label: "GitHub", icon: "🐙", color: "#8B5CF6" },
  file: { label: "File", icon: "📄", color: "#10B981" },
  webhook: { label: "Webhook", icon: "🔔", color: "#F59E0B" },
  "local-cli": { label: "CLI", icon: "⌨", color: "#6B7280" },
  "vector-db": { label: "Vector DB", icon: "🧮", color: "#EC4899" },
};
