/**
 * TypeScript Fallback for Minimax Regret
 * Used if WASM fails to load.
 */

export interface DecisionInput {
  actions: string[];
  states: string[];
  outcomes: Record<string, Record<string, number>>;
  algorithm?: "minimax_regret" | "maximin" | "weighted_sum";
  weights?: Record<string, number>;
  strict?: boolean;
}

export interface DecisionOutput {
  recommended_action: string;
  ranking: string[];
  trace: any;
}

export function evaluateDecisionFallback(input: DecisionInput): DecisionOutput {
  // Handle weights normalization or validation
  let effectiveWeights = input.weights;

  if (input.weights) {
    const sum = Object.values(input.weights).reduce((a, b) => a + b, 0);

    if (input.strict) {
      if (Math.abs(sum - 1.0) > 1e-9) {
        throw new Error(`Weights must sum to 1.0 (got ${sum})`);
      }
    } else if (sum !== 0 && Math.abs(sum - 1.0) > 1e-9) {
      // Normalize if not strict
      effectiveWeights = {};
      for (const [k, v] of Object.entries(input.weights)) {
        effectiveWeights[k] = v / sum;
      }
    }
  }

  // Create effective input with potentially normalized weights
  const effectiveInput = { ...input, weights: effectiveWeights };

  if (input.algorithm === "maximin") {
    return maximinFallback(effectiveInput);
  }
  if (input.algorithm === "weighted_sum") {
    return weightedSumFallback(effectiveInput);
  }

  // 1. Max Utility per State
  const maxStateUtil: Record<string, number> = {};
  for (const state of effectiveInput.states) {
    let max = -Infinity;
    for (const action of effectiveInput.actions) {
      const val = effectiveInput.outcomes[action]?.[state] ?? -Infinity;
      if (val > max) max = val;
    }
    maxStateUtil[state] = max;
  }

  // 2. Regret Table
  const regretTable: Record<string, Record<string, number>> = {};
  const maxRegret: Record<string, number> = {};

  for (const action of effectiveInput.actions) {
    regretTable[action] = {};
    let currentMax = 0;
    for (const state of effectiveInput.states) {
      const util = effectiveInput.outcomes[action]?.[state] ?? 0;
      const regret = maxStateUtil[state] - util;
      regretTable[action][state] = regret;
      if (regret > currentMax) currentMax = regret;
    }
    maxRegret[action] = currentMax;
  }

  // 3. Ranking
  const ranking = [...effectiveInput.actions].sort((a, b) => {
    const diff = maxRegret[a] - maxRegret[b];
    if (Math.abs(diff) < 1e-9) {
      return a < b ? -1 : a > b ? 1 : 0; // Code-point comparison for deterministic tie-break
    }
    return diff;
  });

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "minimax_regret_fallback",
      max_regret: maxRegret,
    },
  };
}

function weightedSumFallback(input: DecisionInput): DecisionOutput {
  const weights = input.weights || {};

  // 1. Calculate Scores
  const scores: Record<string, number> = {};

  for (const action of input.actions) {
    let score = 0;
    for (const state of input.states) {
      const util = input.outcomes[action]?.[state] ?? 0;
      const weight = weights[state] ?? 0;
      score += util * weight;
    }
    scores[action] = score;
  }

  // 2. Ranking
  const ranking = [...input.actions].sort((a, b) => {
    const sA = scores[a];
    const sB = scores[b];
    // Descending sort
    if (Math.abs(sA - sB) < 1e-9) {
      return a < b ? -1 : a > b ? 1 : 0; // Code-point comparison for deterministic tie-break
    }
    return sB - sA;
  });

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "weighted_sum",
      weighted_scores: scores,
    },
  };
}

function maximinFallback(input: DecisionInput): DecisionOutput {
  // 1. Min Utility per Action
  const minUtility: Record<string, number> = {};

  for (const action of input.actions) {
    let min = Infinity;
    for (const state of input.states) {
      const val = input.outcomes[action]?.[state] ?? -Infinity;
      if (val < min) min = val;
    }
    minUtility[action] = min;
  }

  // 2. Ranking
  const ranking = [...input.actions].sort((a, b) => {
    const valA = minUtility[a];
    const valB = minUtility[b];
    // Descending sort for utility
    if (Math.abs(valA - valB) < 1e-9) {
      return a < b ? -1 : a > b ? 1 : 0; // Code-point comparison for deterministic tie-break
    }
    return valB - valA;
  });

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "maximin_fallback",
      min_utility: minUtility,
    },
  };
}
