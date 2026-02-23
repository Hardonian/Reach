/**
 * ReadyLayer Skills Registry
 *
 * Skills are composable units of agent behavior.
 * Each skill has a manifest, declares inputs/tools/model hints, and evaluation hooks.
 */

import type { SkillManifest, SkillComposition } from "./types";

// ── Built-in Skills ──

export const BUILTIN_SKILLS: SkillManifest[] = [
  {
    id: "readiness-check",
    name: "Readiness Check",
    version: "1.0.0",
    description: "Full readiness sweep: tool reliability, policy gates, output schema, latency.",
    icon: "▶",
    inputs: [
      {
        name: "agent_trace",
        type: "json",
        required: true,
        description: "Agent execution trace to evaluate",
      },
      {
        name: "threshold",
        type: "number",
        required: false,
        description: "Minimum passing score (0-100)",
        default: 80,
      },
    ],
    tools: ["trace-parser", "policy-engine", "schema-validator"],
    modelHints: [
      {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        reason: "Best balance of speed and accuracy for evals",
      },
    ],
    evaluationHooks: ["score-gate", "finding-severity-check"],
    tags: ["readiness", "baseline", "beginner"],
  },
  {
    id: "policy-gate",
    name: "Policy Gate",
    version: "1.0.0",
    description:
      "Validate tool calls against defined rules. Catches privilege escalation and banned patterns.",
    icon: "🛡",
    inputs: [
      {
        name: "tool_calls",
        type: "json",
        required: true,
        description: "Array of tool call records",
      },
      {
        name: "policy_config",
        type: "json",
        required: false,
        description: "Custom policy rules",
      },
    ],
    tools: ["policy-engine", "allowlist-checker"],
    modelHints: [],
    evaluationHooks: ["zero-high-severity"],
    tags: ["safety", "policy", "intermediate"],
  },
  {
    id: "regression-detect",
    name: "Change Detection",
    version: "1.0.0",
    description: "Compare current run against saved baseline. Surface behavioral diffs.",
    icon: "⟳",
    inputs: [
      {
        name: "current_run",
        type: "json",
        required: true,
        description: "Current run data",
      },
      {
        name: "baseline_run",
        type: "json",
        required: false,
        description: "Baseline run for comparison",
      },
    ],
    tools: ["diff-engine", "schema-validator", "stats-calculator"],
    modelHints: [],
    evaluationHooks: ["regression-threshold"],
    tags: ["regression", "ci-cd", "beginner"],
  },
  {
    id: "trace-capture",
    name: "Trace Capture",
    version: "1.0.0",
    description: "Capture a full execution trace without enforcing rules. Observation only.",
    icon: "🔍",
    inputs: [
      {
        name: "agent_id",
        type: "string",
        required: true,
        description: "Agent identifier to trace",
      },
    ],
    tools: ["trace-parser", "timeline-builder"],
    modelHints: [],
    evaluationHooks: [],
    tags: ["tracing", "observability", "beginner"],
  },
  {
    id: "release-gate",
    name: "Release Gate",
    version: "1.0.0",
    description: "CI/CD gate that blocks merges when agent score drops below threshold.",
    icon: "🚀",
    inputs: [
      {
        name: "agent_trace",
        type: "json",
        required: true,
        description: "Agent execution trace",
      },
      {
        name: "min_score",
        type: "number",
        required: false,
        description: "Minimum score to pass",
        default: 80,
      },
      {
        name: "block_high_severity",
        type: "boolean",
        required: false,
        description: "Block on any high-severity finding",
        default: true,
      },
    ],
    tools: ["trace-parser", "policy-engine", "diff-engine", "ci-reporter"],
    modelHints: [],
    evaluationHooks: ["score-gate", "zero-high-severity", "regression-threshold"],
    tags: ["release", "ci-cd", "intermediate"],
  },
  {
    id: "mcp-bridge",
    name: "MCP Bridge",
    version: "1.0.0",
    description: "Connect to an MCP server and expose its tools as skill inputs.",
    icon: "🔌",
    inputs: [
      {
        name: "server_url",
        type: "string",
        required: true,
        description: "MCP server endpoint URL",
      },
      {
        name: "auth_token",
        type: "string",
        required: false,
        description: "Bearer token for server auth",
      },
    ],
    tools: ["mcp-client", "tool-discovery"],
    modelHints: [],
    evaluationHooks: [],
    tags: ["mcp", "integration", "advanced"],
  },
];

// ── Registry Operations ──

export function getSkill(id: string): SkillManifest | undefined {
  return BUILTIN_SKILLS.find((s) => s.id === id);
}

export function getSkillsByTag(tag: string): SkillManifest[] {
  return BUILTIN_SKILLS.filter((s) => s.tags.includes(tag));
}

export function getAllSkills(): SkillManifest[] {
  return [...BUILTIN_SKILLS];
}

// ── Skill Composition ──

export function composeSkills(name: string, skillIds: string[]): SkillComposition | null {
  const skills = skillIds.map((id) => getSkill(id)).filter(Boolean);
  if (skills.length !== skillIds.length) return null;

  const connections: Array<{ from: string; to: string }> = [];
  for (let i = 0; i < skillIds.length - 1; i++) {
    connections.push({ from: skillIds[i], to: skillIds[i + 1] });
  }

  return {
    id: `comp-${Date.now()}`,
    name,
    skills: skillIds,
    connections,
  };
}

// ── MCP Export ──

export function skillToMCPConfig(skill: SkillManifest): Record<string, unknown> {
  return {
    name: `readylayer-${skill.id}`,
    version: skill.version,
    description: skill.description,
    tools: skill.inputs.map((input) => ({
      name: input.name,
      description: input.description,
      inputSchema: {
        type: "object",
        properties: {
          [input.name]: {
            type: input.type === "json" ? "object" : input.type,
            description: input.description,
          },
        },
        required: input.required ? [input.name] : [],
      },
    })),
  };
}
