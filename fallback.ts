/**
 * TypeScript Fallback for Minimax Regret
 * Used if WASM fails to load.
 */

export interface DecisionInput {
  actions: string[];
  states: string[];
  outcomes: Record<string, Record<string, number>>;
  algorithm?: "minimax_regret" | "maximin";
}

export interface DecisionOutput {
  recommended_action: string;
  ranking: string[];
  trace: any;
}

export function evaluateDecisionFallback(input: DecisionInput): DecisionOutput {
  if (input.algorithm === "maximin") {
    return maximinFallback(input);
  }

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

  // 2. Regret Table
  const regretTable: Record<string, Record<string, number>> = {};
  const maxRegret: Record<string, number> = {};

  for (const action of input.actions) {
    regretTable[action] = {};
    let currentMax = 0;
    for (const state of input.states) {
      const util = input.outcomes[action]?.[state] ?? 0;
      const regret = maxStateUtil[state] - util;
      regretTable[action][state] = regret;
      if (regret > currentMax) currentMax = regret;
    }
    maxRegret[action] = currentMax;
  }

  // 3. Ranking
  const ranking = [...input.actions].sort((a, b) => {
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
      algorithm: "minimax_regret_fallback",
      max_regret: maxRegret
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
      algorithm: "maximin_fallback",
      min_utility: minUtility
    }
  };
}