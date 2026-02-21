/**
 * ReadyLayer Templates — Starter baselines for common agent readiness patterns.
 *
 * Each template:
 *  - Explains itself in 1 line
 *  - Has a "Use template" action (links to playground with template_id)
 *  - Includes sample fixture data for an immediate visible result
 */

export interface Template {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  category: 'readiness' | 'safety' | 'regression' | 'tracing' | 'release';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  checks: string[];
  sampleFindings: Array<{
    severity: 'high' | 'medium' | 'low';
    title: string;
    fix: string;
  }>;
}

export const TEMPLATES: Template[] = [
  {
    id: 'agent-readiness-baseline',
    name: 'Agent readiness baseline',
    tagline: 'Full readiness sweep before your first deploy.',
    description: 'Runs 12 checks covering tool reliability, policy gates, output schema, and latency budget. The recommended starting point for any new agent.',
    icon: '▶',
    category: 'readiness',
    difficulty: 'beginner',
    checks: [
      'Tool call timeout budget',
      'Output schema consistency',
      'Policy gate: external calls',
      'Token budget enforcement',
      'Error handling coverage',
    ],
    sampleFindings: [
      {
        severity: 'high',
        title: 'Tool timeout exceeded on 2/5 runs',
        fix: 'Set `timeout_ms: 1500` on search_web tool.',
      },
      {
        severity: 'medium',
        title: 'Unguarded external API call',
        fix: 'Add external_calls allow-list to policy config.',
      },
    ],
  },
  {
    id: 'policy-gate-tool-calls',
    name: 'Rules gate: tool calls',
    tagline: 'Block unsafe tool use before it reaches production.',
    description: 'Validates every tool call against your defined rules. Catches privilege escalation, unguarded network calls, and banned tool patterns.',
    icon: '🛡',
    category: 'safety',
    difficulty: 'intermediate',
    checks: [
      'External network access control',
      'File system write permissions',
      'Privileged tool usage',
      'Tool allow/block-list enforcement',
      'Data exfiltration patterns',
    ],
    sampleFindings: [
      {
        severity: 'high',
        title: 'write_file called without approval gate',
        fix: 'Add `require_approval: true` to write_file policy.',
      },
    ],
  },
  {
    id: 'regression-suite-starter',
    name: 'Change detection starter',
    tagline: 'Know exactly what changed between builds.',
    description: 'Compares your current run against a saved baseline. Surfaces behavioral diffs in output schema, latency, and tool usage patterns.',
    icon: '⟳',
    category: 'regression',
    difficulty: 'beginner',
    checks: [
      'Output schema diff',
      'Latency regression (p95)',
      'Tool call count change',
      'Error rate change',
      'Confidence score drift',
    ],
    sampleFindings: [
      {
        severity: 'medium',
        title: '`confidence` field dropped in 1 case',
        fix: 'Pin output schema or update baseline after intentional change.',
      },
    ],
  },
  {
    id: 'tracing-only-starter',
    name: 'Tracing-only starter',
    tagline: 'See every step your agent takes — no rules required.',
    description: 'Captures a full execution trace without enforcing any rules. Use this to understand agent behavior before writing checks.',
    icon: '🔍',
    category: 'tracing',
    difficulty: 'beginner',
    checks: [
      'Step-by-step execution log',
      'Tool call timeline',
      'Token usage per step',
      'LLM call sequence',
    ],
    sampleFindings: [],
  },
  {
    id: 'release-gate-starter',
    name: 'Release gate starter',
    tagline: 'Block merges that regress agent behavior.',
    description: 'CI/CD-ready check that fails if the agent score drops below your threshold. Drop into GitHub Actions in one step.',
    icon: '🚀',
    category: 'release',
    difficulty: 'intermediate',
    checks: [
      'Readiness score gate (≥ 80)',
      'Zero high-severity findings',
      'Regression vs. main branch',
      'Policy compliance',
    ],
    sampleFindings: [
      {
        severity: 'high',
        title: 'Score dropped from 91 to 74 vs. baseline',
        fix: 'Fix tool timeout issue before merging.',
      },
    ],
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: Template['category']): Template[] {
  return TEMPLATES.filter((t) => t.category === category);
}
