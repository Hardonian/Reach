/**
 * Decision Engine Adapter
 * 
 * Provides a unified interface for decision evaluation that can switch between
 * the TypeScript reference engine and the Rust/WASM engine.
 * 
 * The engine switch is controlled by the DECISION_ENGINE environment variable:
 * - "ts" - TypeScript reference engine (default)
 * - "wasm" - Rust/WASM engine (when available)
 * 
 * This adapter ensures the public API remains stable regardless of the underlying engine.
 */

import { z } from 'zod';

// ============================================================================
// Input/Output Schemas
// ============================================================================

/**
 * Input for decision evaluation
 */
export const DecisionInputSchema = z.object({
  // Evidence context
  sourceType: z.enum(['diff', 'drift', 'policy', 'trust', 'manual']),
  sourceRef: z.string(),
  
  // Scope
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  
  // Evidence data
  evidence: z.record(z.unknown()),
  
  // Optional: severity from trigger
  triggerSeverity: z.number().min(0).max(1).optional(),
  
  // Optional: trust context
  trustScore: z.number().min(0).max(1).optional(),
  
  // Optional: policy violations
  policyViolations: z.array(z.object({
    rule: z.string(),
    severity: z.number().min(0).max(1),
    message: z.string(),
  })).optional(),
  
  // Optional: drift data
  driftData: z.record(z.unknown()).optional(),
  
  // Candidate actions to evaluate
  candidateActions: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.unknown()).optional(),
  })).optional(),
});

export type DecisionInput = z.infer<typeof DecisionInputSchema>;

/**
 * Single action recommendation
 */
export const ActionRecommendationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  compositeScore: z.number().min(0).max(1),
  probability: z.number().min(0).max(1).optional(),
  regretScore: z.number().min(0).max(1).optional(),
  riskScore: z.number().min(0).max(1).optional(),
  reasoning: z.string(),
  trace: z.array(z.string()).optional(),
});

export type ActionRecommendation = z.infer<typeof ActionRecommendationSchema>;

/**
 * Result from decision evaluation
 */
export const DecisionResultSchema = z.object({
  // Evaluation metadata
  inputFingerprint: z.string(),
  evaluatedAt: z.string(),
  engineVersion: z.string(),
  
  // Governance badges
  governanceBadges: z.array(z.enum([
    'policy_conflict',
    'low_trust_risk',
    'drift_high_impact',
  ])).optional(),
  
  // Recommendations (ranked by composite score)
  recommendations: z.array(ActionRecommendationSchema),
  
  // Selected best action (highest composite score)
  bestAction: ActionRecommendationSchema.optional(),
  
  // Worst-case analysis
  worstCase: z.object({
    actionId: z.string(),
    scenario: z.string(),
    impact: z.number().min(0).max(1),
    mitigation: z.string().optional(),
  }).optional(),
  
  // Adversarial impact assessment
  adversarialImpact: z.object({
    isAdversarial: z.boolean(),
    attackVector: z.string().optional(),
    defenseStrength: z.number().min(0).max(1),
  }).optional(),
  
  // Regret table (action vs scenario matrix)
  regretTable: z.array(z.object({
    actionId: z.string(),
    actionName: z.string(),
    scenario: z.string(),
    regret: z.number().min(0),
  })).optional(),
  
  // Trace explaining why this decision was made
  decisionTrace: z.array(z.string()),
  
  // Raw engine output (for debugging)
  rawOutput: z.record(z.unknown()).optional(),
});

export type DecisionResult = z.infer<typeof DecisionResultSchema>;

/**
 * Explainability request
 */
export const ExplainRequestSchema = z.object({
  decisionId: z.string(),
  focusArea: z.enum(['recommendation', 'trace', 'regret', 'adversarial', 'governance']).optional(),
});

export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;

/**
 * Explainability response
 */
export const ExplainResponseSchema = z.object({
  decisionId: z.string(),
  focusArea: z.string(),
  explanation: z.string(),
  supportingEvidence: z.array(z.record(z.unknown())),
  confidence: z.number().min(0).max(1),
});

export type ExplainResponse = z.infer<typeof ExplainResponseSchema>;

// ============================================================================
// Engine Interface
// ============================================================================

/**
 * Decision Engine Interface
 * 
 * All decision engines must implement this interface to ensure
 * compatibility with the Decision Pillar.
 */
export interface DecisionEngine {
  /**
   * Evaluate a decision input and return recommendations
   */
  evaluate(input: DecisionInput): Promise<DecisionResult>;
  
  /**
   * Explain a decision (provide detailed reasoning)
   */
  explain(decisionId: string, request: ExplainRequest): Promise<ExplainResponse>;
  
  /**
   * Get engine version info
   */
  getVersion(): string;
}

/**
 * Engine configuration
 */
export interface EngineConfig {
  type: 'ts' | 'wasm';
  wasmPath?: string;
  timeout?: number;
}

// ============================================================================
// Engine Implementations
// ============================================================================

/**
 * TypeScript Reference Engine
 * 
 * A pure TypeScript implementation for decision evaluation.
 * Used as default and for testing.
 */
class TSReferenceEngine implements DecisionEngine {
  private version = 'ts-ref-1.0.0';
  
  async evaluate(input: DecisionInput): Promise<DecisionResult> {
    // Deterministic fingerprint from canonical JSON
    const canonicalJson = JSON.stringify(input, Object.keys(input).sort());
    const inputFingerprint = this.hashString(canonicalJson);
    
    const recommendations = this.computeRecommendations(input);
    const bestAction = recommendations[0];
    
    // Determine governance badges
    const governanceBadges: Array<'policy_conflict' | 'low_trust_risk' | 'drift_high_impact'> = [];
    
    if (input.policyViolations && input.policyViolations.length > 0) {
      governanceBadges.push('policy_conflict');
    }
    
    if (input.trustScore !== undefined && input.trustScore < 0.3) {
      governanceBadges.push('low_trust_risk');
    }
    
    if (input.driftData && input.triggerSeverity && input.triggerSeverity > 0.7) {
      governanceBadges.push('drift_high_impact');
    }
    
    // Compute worst case
    const worstCase = this.computeWorstCase(input, recommendations);
    
    // Compute adversarial impact
    const adversarialImpact = this.computeAdversarialImpact(input);
    
    // Compute regret table
    const regretTable = this.computeRegretTable(input, recommendations);
    
    return {
      inputFingerprint,
      evaluatedAt: new Date().toISOString(),
      engineVersion: this.version,
      governanceBadges: governanceBadges.length > 0 ? governanceBadges : undefined,
      recommendations,
      bestAction,
      worstCase,
      adversarialImpact,
      regretTable,
      decisionTrace: this.generateTrace(input, bestAction),
    };
  }
  
  async explain(decisionId: string, request: ExplainRequest): Promise<ExplainResponse> {
    // Generate explanation based on focus area
    return {
      decisionId,
      focusArea: request.focusArea || 'recommendation',
      explanation: this.generateExplanation(request.focusArea),
      supportingEvidence: [],
      confidence: 0.85,
    };
  }
  
  getVersion(): string {
    return this.version;
  }
  
  private hashString(str: string): string {
    // Simple hash for fingerprinting (SHA-256 would be used in production)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
  
  private computeRecommendations(input: DecisionInput): ActionRecommendation[] {
    const actions = input.candidateActions || [
      { id: 'accept', name: 'Accept', description: 'Accept the change' },
      { id: 'reject', name: 'Reject', description: 'Reject the change' },
      { id: 'review', name: 'Request Review', description: 'Request additional review' },
    ];
    
    return actions.map(action => {
      // Compute deterministic scores based on input
      const baseScore = this.computeBaseScore(input, action.id);
      const probability = this.computeProbability(input, action.id);
      const riskScore = this.computeRiskScore(input, action.id);
      const regretScore = this.computeRegretScore(input, action.id);
      
      // Composite score: weighted combination
      const compositeScore = (baseScore * 0.4) + (probability * 0.3) + ((1 - riskScore) * 0.3);
      
      return {
        id: action.id,
        name: action.name,
        description: action.description,
        compositeScore: Math.round(compositeScore * 100) / 100,
        probability: Math.round(probability * 100) / 100,
        regretScore: Math.round(regretScore * 100) / 100,
        riskScore: Math.round(riskScore * 100) / 100,
        reasoning: this.generateReasoning(input, action.id, compositeScore),
      };
    }).sort((a, b) => b.compositeScore - a.compositeScore);
  }
  
  private computeBaseScore(input: DecisionInput, actionId: string): number {
    // Base score depends on source type and severity
    const severity = input.triggerSeverity || 0.5;
    
    switch (input.sourceType) {
      case 'diff':
        return actionId === 'reject' ? severity : (1 - severity);
      case 'drift':
        return actionId === 'review' ? 0.7 : 0.3;
      case 'policy':
        return actionId === 'reject' ? 0.9 : 0.1;
      case 'trust':
        const trust = input.trustScore || 0.5;
        return trust;
      case 'manual':
        return 0.5;
      default:
        return 0.5;
    }
  }
  
  private computeProbability(_input: DecisionInput, _actionId: string): number {
    // Deterministic probability based on action type
    return 0.7;
  }
  
  private computeRiskScore(input: DecisionInput, actionId: string): number {
    // Risk increases with policy violations and low trust
    let risk = 0.2;
    
    if (input.policyViolations) {
      const avgViolationSeverity = input.policyViolations.reduce(
        (sum, v) => sum + v.severity, 0
      ) / input.policyViolations.length;
      risk += avgViolationSeverity * 0.4;
    }
    
    if (input.trustScore !== undefined) {
      risk += (1 - input.trustScore) * 0.3;
    }
    
    // Accepting changes has higher risk for certain sources
    if (actionId === 'accept' && input.sourceType === 'drift') {
      risk += 0.2;
    }
    
    return Math.min(risk, 1);
  }
  
  private computeRegretScore(_input: DecisionInput, _actionId: string): number {
    // Simple regret calculation
    return 0.15;
  }
  
  private computeWorstCase(input: DecisionInput, recommendations: ActionRecommendation[]) {
    const worstAction = recommendations[recommendations.length - 1];
    
    let scenario = 'Unexpected side effect';
    let impact = 0.5;
    let mitigation = 'Monitor closely after deployment';
    
    if (input.sourceType === 'drift') {
      scenario = 'Configuration drift causes service outage';
      impact = 0.8;
      mitigation = 'Rollback plan ready';
    } else if (input.sourceType === 'policy') {
      scenario = 'Policy violation detected in production';
      impact = 0.9;
      mitigation = 'Block deployment until resolved';
    }
    
    return {
      actionId: worstAction.id,
      scenario,
      impact,
      mitigation,
    };
  }
  
  private computeAdversarialImpact(input: DecisionInput) {
    // Simple adversarial detection
    const isAdversarial = input.sourceType === 'manual' && 
      (input.evidence as Record<string, unknown>)['suspicious'] === true;
    
    return {
      isAdversarial,
      attackVector: isAdversarial ? 'Manual injection' : undefined,
      defenseStrength: isAdversarial ? 0.3 : 0.8,
    };
  }
  
  private computeRegretTable(input: DecisionInput, recommendations: ActionRecommendation[]) {
    const scenarios = ['best_case', 'expected', 'worst_case'];
    
    return recommendations.flatMap(action => 
      scenarios.map(scenario => ({
        actionId: action.id,
        actionName: action.name,
        scenario,
        regret: scenario === 'worst_case' ? 0.4 : scenario === 'expected' ? 0.15 : 0,
      }))
    );
  }
  
  private generateTrace(input: DecisionInput, bestAction?: ActionRecommendation): string[] {
    const trace: string[] = [];
    
    trace.push(`Evaluated ${input.sourceType} from ${input.sourceRef}`);
    
    if (input.triggerSeverity !== undefined) {
      trace.push(`Trigger severity: ${input.triggerSeverity.toFixed(2)}`);
    }
    
    if (input.trustScore !== undefined) {
      trace.push(`Trust score: ${input.trustScore.toFixed(2)}`);
    }
    
    if (input.policyViolations && input.policyViolations.length > 0) {
      trace.push(`Policy violations: ${input.policyViolations.length}`);
    }
    
    if (bestAction) {
      trace.push(`Selected action: ${bestAction.name} (score: ${bestAction.compositeScore.toFixed(2)})`);
    }
    
    return trace;
  }
  
  private generateReasoning(input: DecisionInput, actionId: string, score: number): string {
    const reasons: string[] = [];
    
    if (input.triggerSeverity !== undefined) {
      reasons.push(`severity ${input.triggerSeverity.toFixed(2)}`);
    }
    
    if (input.trustScore !== undefined) {
      reasons.push(`trust ${input.trustScore.toFixed(2)}`);
    }
    
    if (input.policyViolations && input.policyViolations.length > 0) {
      reasons.push(`${input.policyViolations.length} policy violations`);
    }
    
    const reasonStr = reasons.length > 0 ? reasons.join(', ') : 'default analysis';
    return `Action ${actionId} recommended based on ${reasonStr} (composite: ${score.toFixed(2)})`;
  }
  
  private generateExplanation(focusArea?: string): string {
    switch (focusArea) {
      case 'recommendation':
        return 'The recommended action was selected based on highest composite score combining probability, risk, and base merit.';
      case 'trace':
        return 'Decision trace shows evaluation of source severity, trust scores, and policy compliance.';
      case 'regret':
        return 'Regret analysis evaluates the difference between chosen action and optimal action across scenarios.';
      case 'adversarial':
        return 'Adversarial impact assessment evaluates potential attack vectors and defense strength.';
      case 'governance':
        return 'Governance badges highlight policy conflicts, trust risks, and drift impacts that require attention.';
      default:
        return 'This decision was evaluated based on the provided evidence and context.';
    }
  }
}

/**
 * WASM Engine Placeholder
 * 
 * This is a placeholder for the Rust/WASM engine.
 * When the WASM engine is ready, this will load the actual WASM module.
 */
class WASMEnginePlaceholder implements DecisionEngine {
  private version = 'wasm-placeholder-1.0.0';
  
  async evaluate(input: DecisionInput): Promise<DecisionResult> {
    // Placeholder: delegate to TS engine
    const tsEngine = new TSReferenceEngine();
    const result = await tsEngine.evaluate(input);
    result.engineVersion = this.version;
    result.rawOutput = { engine: 'wasm-placeholder' };
    return result;
  }
  
  async explain(decisionId: string, request: ExplainRequest): Promise<ExplainResponse> {
    const tsEngine = new TSReferenceEngine();
    return tsEngine.explain(decisionId, request);
  }
  
  getVersion(): string {
    return this.version;
  }
}

// ============================================================================
// Adapter Factory
// ============================================================================

/**
 * Get the configured decision engine
 * 
 * Engine selection is controlled by DECISION_ENGINE env variable:
 * - "wasm" - WASM engine (when available)
 * - "ts" or anything else - TypeScript reference engine
 */
export function getDecisionEngine(config?: Partial<EngineConfig>): DecisionEngine {
  const engineType = config?.type || (process.env.DECISION_ENGINE as 'ts' | 'wasm') || 'ts';
  
  switch (engineType) {
    case 'wasm':
      // TODO: When WASM engine is ready, load it here
      // return new RealWASMEngine(config.wasmPath);
      return new WASMEnginePlaceholder();
    case 'ts':
    default:
      return new TSReferenceEngine();
  }
}

/**
 * Default engine instance (singleton pattern)
 */
let defaultEngine: DecisionEngine | null = null;

export function getDefaultEngine(): DecisionEngine {
  if (!defaultEngine) {
    defaultEngine = getDecisionEngine();
  }
  return defaultEngine;
}

/**
 * Reset the default engine (useful for testing)
 */
export function resetDefaultEngine(): void {
  defaultEngine = null;
}
