/**
 * TypeScript Fallback for Minimax Regret
 * Used if WASM fails to load.
 */

export interface DecisionInput {
  actions: string[];
  states: string[];
  outcomes: Record<string, Record<string, number>>;
  algorithm?: "minimax_regret" | "maximin" | "weighted_sum" | "softmax" | "hurwicz" | "laplace" | "starr" | "savage" | "wald";
  algorithm?: "minimax_regret" | "maximin" | "weighted_sum" | "softmax" | "hurwicz" | "laplace" | "starr" | "savage" | "wald" | "hodges_lehmann";
  weights?: Record<string, number>;
  strict?: boolean;
  temperature?: number;
  optimism?: number;
  confidence?: number;
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
      for (const v of Object.values(input.weights)) {
        if (v < 0.0 || v > 1.0) {
          throw new Error(`Probability value must be between 0.0 and 1.0 (got ${v})`);
        }
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

  // Validate outcomes
  for (const action of effectiveInput.actions) {
    for (const state of effectiveInput.states) {
      const val = effectiveInput.outcomes[action]?.[state];
      if (val !== undefined && !Number.isFinite(val)) {
        throw new Error("Utility value cannot be NaN or Infinity");
      }
    }
  }

  if (input.algorithm === "maximin" || input.algorithm === "wald") {
    return maximinFallback(effectiveInput);
  }
  if (input.algorithm === "weighted_sum") {
    return weightedSumFallback(effectiveInput);
  }
  if (input.algorithm === "softmax") {
    return softmaxFallback(effectiveInput);
  }
  if (input.algorithm === "hurwicz") {
    return hurwiczFallback(effectiveInput);
  }
  if (input.algorithm === "laplace") {
    return laplaceFallback(effectiveInput);
  }
  if (input.algorithm === "starr") {
    return starrFallback(effectiveInput);
  }
  if (input.algorithm === "hodges_lehmann") {
    return hodgesLehmannFallback(effectiveInput);
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
      return a.localeCompare(b); // Tie-break
    }
    return diff;
  });

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "minimax_regret",
      max_regret: maxRegret
    }
  };
}

export function validateOutcomesFallback(input: DecisionInput): boolean {
  for (const action of input.actions) {
    const stateMap = input.outcomes[action];
    if (!stateMap) {
      throw new Error(`Missing outcome for action '${action}' in state 'ALL'`);
    }
    for (const state of input.states) {
      const val = stateMap[state];
      if (val === undefined) {
        throw new Error(`Missing outcome for action '${action}' in state '${state}'`);
      }
      if (!Number.isFinite(val)) {
        throw new Error("Utility value cannot be NaN or Infinity");
      }
    }
  }
  return true;
}

function laplaceFallback(input: DecisionInput): DecisionOutput {
  const numStates = input.states.length;
  if (numStates === 0) throw new Error("Cannot apply Laplace criterion with no states");

  const scores: Record<string, number> = {};

  for (const action of input.actions) {
    let sum = 0;
    for (const state of input.states) {
      const val = input.outcomes[action]?.[state] ?? 0;
      sum += val;
    }
    scores[action] = sum / numStates;
  }

  const ranking = [...input.actions].sort((a, b) => {
    const sA = scores[a];
    const sB = scores[b];
    if (Math.abs(sA - sB) < 1e-9) return a.localeCompare(b);
    return sB - sA;
  });

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "laplace",
      laplace_scores: scores
    }
  };
}

function starrFallback(input: DecisionInput): DecisionOutput {
  const weights = input.weights || {};
  
  // 1. Max Utility per State
  const maxStateUtil: Record<string, number> = {};
  for (const state of input.states) {
    let max = -Infinity;
    for (const action of input.actions) {
      const val = input.outcomes[action]?.[state] ?? -Infinity;
      if (val > max) max = val;
    }
    maxStateUtil[state] = max;
  }

  // 2. Expected Regret
  const scores: Record<string, number> = {};

  for (const action of input.actions) {
    let expectedRegret = 0;
    for (const state of input.states) {
      const util = input.outcomes[action]?.[state] ?? 0;
      const regret = maxStateUtil[state] - util;
      const prob = weights[state] ?? 0;
      expectedRegret += regret * prob;
    }
    scores[action] = expectedRegret;
  }

  // 3. Ranking (Ascending)
  const ranking = [...input.actions].sort((a, b) => {
    const sA = scores[a];
    const sB = scores[b];
    if (Math.abs(sA - sB) < 1e-9) return a.localeCompare(b);
    return sA - sB; // Lower is better
  });

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "starr",
      starr_scores: scores
    }
  };
}

function hodgesLehmannFallback(input: DecisionInput): DecisionOutput {
  const alpha = input.confidence ?? 0.5;
  if (alpha < 0 || alpha > 1) throw new Error("Confidence (alpha) must be between 0.0 and 1.0");
  const numStates = input.states.length;
  if (numStates === 0) throw new Error("Cannot apply Hodges-Lehmann criterion with no states");

  const scores: Record<string, number> = {};

  for (const action of input.actions) {
    let min = Infinity;
    let sum = 0;
    for (const state of input.states) {
      const val = input.outcomes[action]?.[state] ?? -Infinity;
      if (val < min) min = val;
      sum += val;
    }
    const avg = sum / numStates;
    scores[action] = (alpha * min) + ((1.0 - alpha) * avg);
  }

  const ranking = [...input.actions].sort((a, b) => {
    const sA = scores[a];
    const sB = scores[b];
    if (Math.abs(sA - sB) < 1e-9) return a.localeCompare(b);
    return sB - sA;
  });

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "hodges_lehmann",
      hodges_lehmann_scores: scores
    }
  };
}

function hurwiczFallback(input: DecisionInput): DecisionOutput {
  const alpha = input.optimism ?? 0.5;
  if (alpha < 0 || alpha > 1) throw new Error("Optimism (alpha) must be between 0.0 and 1.0");

  const scores: Record<string, number> = {};

  for (const action of input.actions) {
    let min = Infinity;
    let max = -Infinity;
    for (const state of input.states) {
      const val = input.outcomes[action]?.[state] ?? -Infinity;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    scores[action] = (alpha * max) + ((1.0 - alpha) * min);
  }

  const ranking = [...input.actions].sort((a, b) => {
    const sA = scores[a];
    const sB = scores[b];
    if (Math.abs(sA - sB) < 1e-9) return a.localeCompare(b);
    return sB - sA;
  });

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "hurwicz",
      hurwicz_scores: scores
    }
  };
}

export function validateProbabilitiesFallback(input: DecisionInput): boolean {
  if (input.weights) {
    for (const v of Object.values(input.weights)) {
      if (v < 0.0 || v > 1.0) {
        throw new Error(`Probability value must be between 0.0 and 1.0 (got ${v})`);
      }
    }
  }
  return true;
}

export function validateStructureFallback(input: DecisionInput): boolean {
  for (const action of input.actions) {
    const stateMap = input.outcomes[action];
    if (!stateMap) {
      throw new Error(`Missing outcome for action '${action}' in state 'ALL'`);
    }
    for (const state of input.states) {
      if (stateMap[state] === undefined) {
        throw new Error(`Missing outcome for action '${action}' in state '${state}'`);
      }
    }
  }
  return true;
}

function softmaxFallback(input: DecisionInput): DecisionOutput {
  const weights = input.weights || {};
  const temp = input.temperature ?? 1.0;

  if (temp <= 0) throw new Error("Temperature must be positive");

  // 1. Calculate Scores
  const scores: Record<string, number> = {};
  let maxScore = -Infinity;

  for (const action of input.actions) {
    let score = 0;
    for (const state of input.states) {
      const util = input.outcomes[action]?.[state] ?? 0;
      const weight = weights[state] ?? 0;
      score += util * weight;
    }
    scores[action] = score;
    if (score > maxScore) maxScore = score;
  }

  // 2. Calculate Probabilities
  const probabilities: Record<string, number> = {};
  let sumExp = 0;
  const exps: Record<string, number> = {};

  for (const action of input.actions) {
    const val = Math.exp((scores[action] - maxScore) / temp);
    exps[action] = val;
    sumExp += val;
  }

  for (const action of input.actions) {
    probabilities[action] = exps[action] / sumExp;
  }

  // 3. Ranking
  const ranking = [...input.actions].sort((a, b) => {
    return probabilities[b] - probabilities[a] || a.localeCompare(b);
  });

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "softmax",
      weighted_scores: scores,
      probabilities
    }
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
      return a.localeCompare(b);
    }
    return sB - sA;
  });

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "weighted_sum",
      weighted_scores: scores
    }
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
      return a.localeCompare(b); // Tie-break
    }
    return valB - valA;
  });

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "maximin",
      min_utility: minUtility
    }
  };
}