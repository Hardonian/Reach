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
  {
    id: 'fintech-reliability-pack',
    name: 'Fintech: High-Stakes Trading',
    tagline: 'Precision and compliance for financial agents.',
    description: 'Enforces circuit breakers, slippage limits, and multi-sig approval for large transactions. Critical for agents handling treasury or trading.',
    icon: '💸',
    category: 'release',
    difficulty: 'advanced',
    checks: [
      'Circuit breaker: High volatility',
      'Slippage budget (< 0.5%)',
      'Multi-sig approval gate (> $1k)',
      'Balance sufficiency check',
      'Audit log signing integrity',
    ],
    sampleFindings: [
      {
        severity: 'high',
        title: 'Slippage exceeded 2% in simulation',
        fix: 'Lower max_slippage param in trade_tool.',
      },
    ],
  },
  {
    id: 'support-automation-pack',
    name: 'Support: Accuracy & Tone',
    tagline: 'Quality control for customer-facing agents.',
    description: 'Monitors sentiment drift, hallucination rates, and knowledge base grounding. Ensures your agent stays helpful and accurate.',
    icon: '🎧',
    category: 'readiness',
    difficulty: 'intermediate',
    checks: [
      'Hallucination detect (RAG grounding)',
      'Sentiment drift monitoring',
      'SLA response time gate',
      'PII scrubbing verification',
      'Knowledge base parity check',
    ],
    sampleFindings: [
      {
        severity: 'medium',
        title: 'Tone becoming overly aggressive on billing queries',
        fix: 'Adjust system prompt temperature or few-shot examples.',
      },
    ],
  },
  {
    id: 'compliance-policy-pack',
    name: 'Compliance: GDPR & SOC2',
    tagline: 'Zero-trust guardrails for data handling.',
    description: 'Automated privacy audits and data exfiltration patterns. Blocks agents from accessing or leaking restricted PII.',
    icon: '🛡',
    category: 'safety',
    difficulty: 'advanced',
    checks: [
      'PII exfiltration pattern detect',
      'Data residency gate (EU/US)',
      'Encryption-at-rest verification',
      'Access log completeness',
      'GDPR Right-to-be-forgotten hook',
    ],
    sampleFindings: [
      {
        severity: 'high',
        title: 'Email address detected in unencrypted log',
        fix: 'Enable PII masking in telemetry config.',
      },
    ],
  },
  {
    id: 'ecommerce-ops-pack',
    name: 'E-commerce: Inventory & Price',
    tagline: 'Scale safely across multiple channels.',
    description: 'Sync verification between Shopify, Amazon, and ERP. Prevents overselling and price disparity errors.',
    icon: '🛒',
    category: 'regression',
    difficulty: 'intermediate',
    checks: [
      'Cross-channel price parity',
      'Inventory race condition detect',
      'Stock floor enforcement',
      'Promotional period gate',
      'Customer tier pricing verification',
    ],
    sampleFindings: [
      {
        severity: 'high',
        title: 'Inventory sync delay > 60s',
        fix: 'Increase webhook retry frequency in worker.',
      },
    ],
  },
  {
    id: 'internal-tool-pack',
    name: 'Internal AI: Productivity',
    tagline: 'Ship internal bots with corporate guardrails.',
    description: 'Standardized checks for internal HR, IT, and legal bots. Enforces SSO, corporate policy, and budget caps.',
    icon: '🏢',
    category: 'readiness',
    difficulty: 'beginner',
    checks: [
      'SSO session validation',
      'Departmental budget gate',
      'Usage quota enforcement',
      'Feedback loop integration',
      'Model performance monitoring',
    ],
    sampleFindings: [
      {
        severity: 'low',
        title: 'Daily token quota 90% reached',
        fix: 'Request quota increase or optimize prompts.',
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
