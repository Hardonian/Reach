/**
 * TypeScript fallback implementation of the decision engine.
 *
 * This module provides a pure TypeScript implementation that matches the
 * Rust/WASM behavior. It is used when WASM is not available.
 *
 * IMPORTANT: This implementation MUST produce identical outputs to the Rust
 * implementation for the same inputs. See docs/CANONICALIZATION_SPEC.md.
 */

import type {
  ActionOption,
  DecisionInput,
  DecisionOutput,
  RankedAction,
  Scenario,
  DecisionTrace,
  CompositeWeights,
} from './types';

/** Precision for float normalization (1e-9) */
const FLOAT_PRECISION = 1e-9;

/**
 * Normalize a float to fixed precision for deterministic comparison.
 */
export function floatNormalize(value: number): number {
  if (Number.isNaN(value)) {
    return 0.0;
  }
  if (!Number.isFinite(value)) {
    return value > 0 ? Number.MAX_VALUE : -Number.MAX_VALUE;
  }
  return Math.round(value / FLOAT_PRECISION) * FLOAT_PRECISION;
}

/**
 * Create a canonical JSON string with sorted keys and normalized floats.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * Recursively canonicalize a value for deterministic serialization.
 */
function canonicalize(value: unknown): unknown {
  if (value === null) {
    return null;
  }
  if (value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return floatNormalize(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize(obj[key]);
    }
    return result;
  }
  return null;
}

/**
 * Compute SHA-256 hash of a string.
 * Returns a 64-character lowercase hex string.
 */
export async function stableHash(bytes: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(bytes);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute SHA-256 hash synchronously using Node.js crypto (for Node.js environments).
 */
export function stableHashSync(bytes: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/**
 * Compute deterministic fingerprint for a DecisionInput.
 */
export function computeFingerprint(input: DecisionInput): string {
  // Create canonical input for fingerprinting
  const canonicalInput = {
    id: input.id,
    actions: [...input.actions].sort((a, b) => a.id.localeCompare(b.id)),
    scenarios: [...input.scenarios].sort((a, b) => a.id.localeCompare(b.id)),
    outcomes: [...input.outcomes].sort((a, b) => {
      const actionCmp = a[0].localeCompare(b[0]);
      if (actionCmp !== 0) return actionCmp;
      return a[1].localeCompare(b[1]);
    }),
    constraints: input.constraints,
    evidence: input.evidence,
    // Note: meta is intentionally excluded from fingerprint
  };

  const canonical = canonicalJson(canonicalInput);
  return stableHashSync(canonical);
}

/**
 * Build utility table from outcomes.
 */
function buildUtilityTable(
  actions: ActionOption[],
  scenarios: Scenario[],
  outcomes: [string, string, number][]
): Map<string, Map<string, number>> {
  const table = new Map<string, Map<string, number>>();

  // Initialize with zeros
  for (const action of actions) {
    const scenarioMap = new Map<string, number>();
    for (const scenario of scenarios) {
      scenarioMap.set(scenario.id, 0.0);
    }
    table.set(action.id, scenarioMap);
  }

  // Fill in outcomes
  for (const [actionId, scenarioId, utility] of outcomes) {
    const scenarioMap = table.get(actionId);
    if (scenarioMap) {
      scenarioMap.set(scenarioId, floatNormalize(utility));
    }
  }

  return table;
}

/**
 * Compute worst-case (maximin) scores.
 */
function computeWorstCaseScores(
  utilityTable: Map<string, Map<string, number>>
): Map<string, number> {
  const worstCase = new Map<string, number>();

  for (const [actionId, scenarioMap] of utilityTable) {
    let minUtility = Infinity;
    for (const utility of scenarioMap.values()) {
      minUtility = Math.min(minUtility, utility);
    }
    worstCase.set(actionId, floatNormalize(minUtility));
  }

  return worstCase;
}

/**
 * Compute minimax regret scores.
 */
function computeMinimaxRegretScores(
  utilityTable: Map<string, Map<string, number>>,
  scenarios: Scenario[]
): { regretTable: Map<string, Map<string, number>>; maxRegret: Map<string, number> } {
  const regretTable = new Map<string, Map<string, number>>();
  const maxRegret = new Map<string, number>();

  // Find best utility per scenario
  const bestByScenario = new Map<string, number>();
  for (const scenario of scenarios) {
    let best = -Infinity;
    for (const scenarioMap of utilityTable.values()) {
      const utility = scenarioMap.get(scenario.id) ?? 0;
      best = Math.max(best, utility);
    }
    bestByScenario.set(scenario.id, floatNormalize(best));
  }

  // Compute regret for each action in each scenario
  for (const [actionId, scenarioMap] of utilityTable) {
    const actionRegrets = new Map<string, number>();
    let maxR = 0.0;

    for (const [scenarioId, utility] of scenarioMap) {
      const best = bestByScenario.get(scenarioId) ?? 0;
      const regret = floatNormalize(best - utility);
      actionRegrets.set(scenarioId, regret);
      maxR = Math.max(maxR, regret);
    }

    regretTable.set(actionId, actionRegrets);
    maxRegret.set(actionId, floatNormalize(maxR));
  }

  return { regretTable, maxRegret };
}

/**
 * Compute adversarial robustness scores.
 */
function computeAdversarialScores(
  utilityTable: Map<string, Map<string, number>>,
  scenarios: Scenario[]
): Map<string, number> {
  const adversarialScenarios = scenarios.filter(s => s.adversarial);

  if (adversarialScenarios.length === 0) {
    return computeWorstCaseScores(utilityTable);
  }

  const adversarialIds = new Set(adversarialScenarios.map(s => s.id));
  const adversarialScores = new Map<string, number>();

  for (const [actionId, scenarioMap] of utilityTable) {
    let minAdv = Infinity;
    for (const [scenarioId, utility] of scenarioMap) {
      if (adversarialIds.has(scenarioId)) {
        minAdv = Math.min(minAdv, utility);
      }
    }
    adversarialScores.set(actionId, floatNormalize(minAdv));
  }

  return adversarialScores;
}

/**
 * Get default composite weights.
 */
function getDefaultWeights(): CompositeWeights {
  return {
    worstCase: 0.4,
    minimaxRegret: 0.4,
    adversarial: 0.2,
  };
}

/**
 * Compute composite scores from individual metrics.
 */
function computeCompositeScores(
  worstCase: Map<string, number>,
  maxRegret: Map<string, number>,
  adversarial: Map<string, number>,
  weights: CompositeWeights
): Map<string, number> {
  const composite = new Map<string, number>();

  // Normalize weights
  const sum = weights.worstCase + weights.minimaxRegret + weights.adversarial;
  const wWc = weights.worstCase / sum;
  const wMr = weights.minimaxRegret / sum;
  const wAdv = weights.adversarial / sum;

  for (const actionId of worstCase.keys()) {
    const wcScore = worstCase.get(actionId) ?? 0;
    const mrScore = maxRegret.get(actionId) ?? 0;
    const advScore = adversarial.get(actionId) ?? 0;

    // Composite: higher is better, but minimax regret needs to be inverted
    const compositeScore = floatNormalize(
      wWc * wcScore + wMr * (100.0 - mrScore) + wAdv * advScore
    );

    composite.set(actionId, compositeScore);
  }

  return composite;
}

/**
 * Convert Map to Record for JSON serialization.
 */
function mapToRecord<K extends string, V>(map: Map<K, V>): Record<K, V> {
  const record = {} as Record<K, V>;
  for (const [key, value] of map) {
    record[key] = value;
  }
  return record;
}

/**
 * Convert nested Map to nested Record for JSON serialization.
 */
function nestedMapToRecord(
  map: Map<string, Map<string, number>>
): Record<string, Record<string, number>> {
  const record: Record<string, Record<string, number>> = {};
  for (const [key, value] of map) {
    record[key] = mapToRecord(value);
  }
  return record;
}

/**
 * Main entry point: evaluate a decision problem.
 */
export function evaluateDecision(input: DecisionInput): DecisionOutput {
  // Validate input
  if (input.actions.length === 0) {
    throw new Error('At least one action is required');
  }
  if (input.scenarios.length === 0) {
    throw new Error('At least one scenario is required');
  }
  if (input.outcomes.length === 0) {
    throw new Error('At least one outcome is required');
  }

  // Build utility table
  const utilityTable = buildUtilityTable(
    input.actions,
    input.scenarios,
    input.outcomes
  );

  // Compute all scores
  const worstCase = computeWorstCaseScores(utilityTable);
  const { regretTable, maxRegret } = computeMinimaxRegretScores(
    utilityTable,
    input.scenarios
  );
  const adversarial = computeAdversarialScores(utilityTable, input.scenarios);

  // Get weights
  const weights = getDefaultWeights();

  const composite = computeCompositeScores(worstCase, maxRegret, adversarial, weights);

  // Rank actions (sort by composite score, descending)
  const ranked: [string, number][] = Array.from(composite.entries());
  ranked.sort((a, b) => {
    const cmp = b[1] - a[1];
    if (Math.abs(cmp) < FLOAT_PRECISION) {
      // Tie-break: lexicographic by action_id
      return a[0].localeCompare(b[0]);
    }
    return cmp > 0 ? 1 : -1;
  });

  // Build ranked actions
  const rankedActions: RankedAction[] = ranked.map(([actionId, compScore], index) => {
    const wc = worstCase.get(actionId) ?? 0;
    const mr = maxRegret.get(actionId) ?? 0;
    const adv = adversarial.get(actionId) ?? 0;

    return {
      actionId,
      scoreWorstCase: wc,
      scoreMinimaxRegret: mr,
      scoreAdversarial: adv,
      compositeScore: compScore,
      recommended: index === 0,
      rank: index + 1,
    };
  });

  // Compute fingerprint
  const fingerprint = computeFingerprint(input);

  // Build trace
  const trace: DecisionTrace = {
    utilityTable: nestedMapToRecord(utilityTable),
    worstCaseTable: mapToRecord(worstCase),
    regretTable: nestedMapToRecord(regretTable),
    maxRegretTable: mapToRecord(maxRegret),
    adversarialTable: mapToRecord(adversarial),
    compositeWeights: weights,
    tieBreakRule: 'lexicographic_by_action_id',
  };

  return {
    rankedActions,
    determinismFingerprint: fingerprint,
    trace,
  };
}

/**
 * Get the engine version.
 */
export function getEngineVersion(): string {
  return '0.2.0-fallback';
}
