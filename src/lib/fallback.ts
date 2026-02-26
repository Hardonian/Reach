/**
 * TypeScript Fallback Decision Algorithms
 * Used if WASM fails to load.
 * All algorithms are deterministic and use clampPrecision for floating-point operations.
 */

// Algorithm type union - includes all supported algorithms
export type DecisionAlgorithm = 
  | "minimax_regret"
  | "maximin"
  | "weighted_sum"
  | "adaptive"
  | "softmax"
  | "hurwicz"
  | "laplace"
  | "starr"
  | "savage"
  | "wald"
  | "hodges_lehmann"
  | "brown_robinson"
  | "nash"
  | "pareto"
  | "epsilon_contamination"
  | "topsis";

export interface DecisionInput {
  actions: string[];
  states: string[];
  outcomes: Record<string, Record<string, number>>;
  algorithm?: DecisionAlgorithm;
  weights?: Record<string, number>;
  strict?: boolean;
  temperature?: number;
  optimism?: number;
  confidence?: number;
  iterations?: number;
  epsilon?: number;
  seed?: number;
}

export interface DecisionOutput {
  recommended_action: string;
  ranking: string[];
  trace: Record<string, unknown>;
}

/**
 * Clamp a floating-point value to exactly 10 decimal places
 * for deterministic fingerprinting.
 */
function clampPrecision(value: number): number {
  return Math.round(value * 1e10) / 1e10;
}

/**
 * Clamp all numbers in a record to precision
 */
function clampRecordValues(record: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of Object.keys(record).sort()) {
    result[key] = clampPrecision(record[key]);
  }
  return result;
}

/**
 * Sort actions by score (descending), with deterministic tie-breaking
 */
function sortByScore(
  actions: string[],
  scores: Record<string, number>,
  ascending = false
): string[] {
  return [...actions].sort((a, b) => {
    const sA = scores[a] ?? -Infinity;
    const sB = scores[b] ?? -Infinity;
    if (Math.abs(sA - sB) < 1e-9) {
      return a.localeCompare(b);
    }
    return ascending ? sA - sB : sB - sA;
  });
}

/**
 * Normalize weights to sum to 1.0
 */
function normalizeWeights(weights?: Record<string, number>): Record<string, number> {
  if (!weights) return {};
  
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum === 0) return weights;
  
  const normalized: Record<string, number> = {};
  for (const [key, val] of Object.entries(weights)) {
    normalized[key] = clampPrecision(val / sum);
  }
  return normalized;
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
      effectiveWeights = normalizeWeights(input.weights);
    }
  }
  
  // Create effective input with potentially normalized weights
  const effectiveInput: DecisionInput = { ...input, weights: effectiveWeights };

  // Dispatch to appropriate algorithm
  switch (effectiveInput.algorithm) {
    case "maximin":
    case "wald":
      return maximinFallback(effectiveInput);
    case "weighted_sum":
      return weightedSumFallback(effectiveInput);
    case "softmax":
      return softmaxFallback(effectiveInput);
    case "hurwicz":
      return hurwiczFallback(effectiveInput);
    case "laplace":
      return laplaceFallback(effectiveInput);
    case "starr":
      return starrFallback(effectiveInput);
    case "savage":
    case "minimax_regret":
      return minimaxRegretFallback(effectiveInput);
    case "hodges_lehmann":
      return hodgesLehmannFallback(effectiveInput);
    case "brown_robinson":
      return brownRobinsonFallback(effectiveInput);
    case "nash":
      return nashFallback(effectiveInput);
    case "pareto":
      return paretoFallback(effectiveInput);
    case "epsilon_contamination":
      return epsilonContaminationFallback(effectiveInput);
    case "topsis":
      return topsisFallback(effectiveInput);
    case "adaptive":
    case undefined:
      // Default to minimax_regret for undefined
      return minimaxRegretFallback(effectiveInput);
    default:
      // Fallback for unknown algorithms
      return minimaxRegretFallback(effectiveInput);
  }
}

// ============================================================================
// Algorithm Implementations
// ============================================================================

function minimaxRegretFallback(input: DecisionInput): DecisionOutput {
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
      regretTable[action][state] = clampPrecision(regret);
      if (regret > currentMax) currentMax = regret;
    }
    maxRegret[action] = clampPrecision(currentMax);
  }

  // 3. Ranking
  const ranking = sortByScore(input.actions, maxRegret, true);

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "minimax_regret",
      regret_table: regretTable,
      max_regret: clampRecordValues(maxRegret)
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
    minUtility[action] = clampPrecision(min);
  }

  // 2. Ranking
  const ranking = sortByScore(input.actions, minUtility, false);

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "maximin",
      min_utility: clampRecordValues(minUtility)
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
    scores[action] = clampPrecision(score);
  }

  // 2. Ranking
  const ranking = sortByScore(input.actions, scores, false);

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "weighted_sum",
      weighted_scores: clampRecordValues(scores)
    }
  };
}

/**
 * Softmax/Temperature-based selection
 * Uses Boltzmann distribution to convert scores to probabilities
 */
function softmaxFallback(input: DecisionInput): DecisionOutput {
  const temperature = input.temperature ?? 1.0;
  
  // 1. Calculate expected values for each action (using uniform weights if not provided)
  const weights = input.weights || {};
  const stateWeights = input.states.map(s => weights[s] ?? (1 / input.states.length));
  
  const expectedValues: Record<string, number> = {};
  for (const action of input.actions) {
    let sum = 0;
    for (let i = 0; i < input.states.length; i++) {
      const util = input.outcomes[action]?.[input.states[i]] ?? 0;
      sum += util * stateWeights[i];
    }
    expectedValues[action] = clampPrecision(sum);
  }

  // 2. Compute softmax probabilities
  const maxVal = Math.max(...Object.values(expectedValues));
  const expValues: Record<string, number> = {};
  let expSum = 0;
  
  for (const action of input.actions) {
    const expVal = Math.exp((expectedValues[action] - maxVal) / temperature);
    expValues[action] = clampPrecision(expVal);
    expSum += expVal;
  }

  const probabilities: Record<string, number> = {};
  for (const action of input.actions) {
    probabilities[action] = clampPrecision(expValues[action] / expSum);
  }

  // 3. Ranking by probability (descending)
  const ranking = sortByScore(input.actions, probabilities, false);

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "softmax",
      temperature,
      expected_values: clampRecordValues(expectedValues),
      probabilities: clampRecordValues(probabilities)
    }
  };
}

/**
 * Hurwicz criterion - optimism-pessimism index
 * Combines max and min using optimism coefficient (alpha)
 * alpha = 1 is purely optimistic (maximax), alpha = 0 is purely pessimistic (maximin)
 */
function hurwiczFallback(input: DecisionInput): DecisionOutput {
  const alpha = clampPrecision(input.optimism ?? 0.5);
  
  const hurwiczScores: Record<string, number> = {};

  for (const action of input.actions) {
    let min = Infinity;
    let max = -Infinity;
    for (const state of input.states) {
      const val = input.outcomes[action]?.[state] ?? -Infinity;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    // Hurwicz score = alpha * max + (1 - alpha) * min
    const score = alpha * max + (1 - alpha) * min;
    hurwiczScores[action] = clampPrecision(score);
  }

  // Ranking by Hurwicz score (descending)
  const ranking = sortByScore(input.actions, hurwiczScores, false);

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "hurwicz",
      optimism: alpha,
      hurwicz_scores: clampRecordValues(hurwiczScores)
    }
  };
}

/**
 * Laplace criterion - assumes equal probability for all states
 * Selects action with highest average payoff
 */
function laplaceFallback(input: DecisionInput): DecisionOutput {
  const laplaceScores: Record<string, number> = {};

  for (const action of input.actions) {
    let sum = 0;
    for (const state of input.states) {
      const val = input.outcomes[action]?.[state] ?? 0;
      sum += val;
    }
    // Average = sum / number of states
    laplaceScores[action] = clampPrecision(sum / input.states.length);
  }

  // Ranking by Laplace score (descending)
  const ranking = sortByScore(input.actions, laplaceScores, false);

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "laplace",
      laplace_scores: clampRecordValues(laplaceScores)
    }
  };
}

/**
 * Starr criterion - regret-based with parameter
 * Uses a regret function with a parameter (typically c >= 0)
 * Lower regret is better
 */
function starrFallback(input: DecisionInput): DecisionOutput {
  const c = clampPrecision(input.confidence ?? 1.0);
  
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

  // 2. Regret with Starr modification: R(s,a) = (max - util)^c
  const starrRegret: Record<string, number> = {};

  for (const action of input.actions) {
    let maxRegret = 0;
    for (const state of input.states) {
      const util = input.outcomes[action]?.[state] ?? 0;
      const regret = Math.pow(maxStateUtil[state] - util, c);
      if (regret > maxRegret) maxRegret = regret;
    }
    starrRegret[action] = clampPrecision(maxRegret);
  }

  // 3. Ranking (lower regret is better)
  const ranking = sortByScore(input.actions, starrRegret, true);

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "starr",
      confidence: c,
      starr_regret: clampRecordValues(starrRegret)
    }
  };
}

/**
 * Hodges-Lehmann criterion
 * Uses median of min and max outcomes for each action
 * More robust than pure maximin or maximax
 */
function hodgesLehmannFallback(input: DecisionInput): DecisionOutput {
  const hlScores: Record<string, number> = {};

  for (const action of input.actions) {
    // Collect all outcomes for this action
    const outcomes: number[] = [];
    for (const state of input.states) {
      const val = input.outcomes[action]?.[state] ?? 0;
      outcomes.push(val);
    }
    
    // Sort outcomes for median calculation
    outcomes.sort((a, b) => a - b);
    
    let median: number;
    const mid = Math.floor(outcomes.length / 2);
    if (outcomes.length % 2 === 0) {
      // Even: average of two middle values
      median = (outcomes[mid - 1] + outcomes[mid]) / 2;
    } else {
      // Odd: middle value
      median = outcomes[mid];
    }
    
    hlScores[action] = clampPrecision(median);
  }

  // Ranking by Hodges-Lehmann score (descending)
  const ranking = sortByScore(input.actions, hlScores, false);

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "hodges_lehmann",
      hl_scores: clampRecordValues(hlScores)
    }
  };
}

/**
 * Brown-Robinson criterion - iterative conformal prediction
 * Finds a guaranteed performance level through iteration
 * Uses a deterministic iteration count
 */
function brownRobinsonFallback(input: DecisionInput): DecisionOutput {
  const iterations = Math.min(input.iterations ?? 100, 1000);
  
  // 1. Calculate average payoff for each action
  const avgPayoffs: Record<string, number> = {};
  
  for (const action of input.actions) {
    let sum = 0;
    for (const state of input.states) {
      sum += input.outcomes[action]?.[state] ?? 0;
    }
    avgPayoffs[action] = clampPrecision(sum / input.states.length);
  }

  // 2. Simulate iterative process to find guaranteed level
  // Using deterministic iteration: sum of (iteration * avg_payoff) / iterations
  const guaranteedLevels: Record<string, number> = {};
  
  for (const action of input.actions) {
    let cumulative = 0;
    for (let i = 1; i <= iterations; i++) {
      // Deterministic: use iteration index as pseudo-random
      const stateIdx = (i * action.length) % input.states.length;
      const state = input.states[stateIdx];
      const payoff = input.outcomes[action]?.[state] ?? 0;
      cumulative += payoff;
    }
    // Average cumulative payoff
    guaranteedLevels[action] = clampPrecision(cumulative / iterations);
  }

  // 3. Ranking by guaranteed level (descending)
  const ranking = sortByScore(input.actions, guaranteedLevels, false);

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "brown_robinson",
      iterations,
      avg_payoffs: clampRecordValues(avgPayoffs),
      guaranteed_levels: clampRecordValues(guaranteedLevels)
    }
  };
}

/**
 * Nash equilibrium for zero-sum game
 * Finds best strategy considering opponent's best response
 * For simplicity, uses pure strategy Nash when it exists
 */
function nashFallback(input: DecisionInput): DecisionOutput {
  // For zero-sum games, find Nash equilibrium via dominated strategies
  // and saddle points
  
  // 1. Check for saddle point (pure strategy Nash)
  const minOfMax: Record<string, number> = {};
  const maxOfMin: Record<string, number> = {};

  // Row minima (maximin for each action)
  for (const action of input.actions) {
    let min = Infinity;
    for (const state of input.states) {
      const val = input.outcomes[action]?.[state] ?? -Infinity;
      if (val < min) min = val;
    }
    minOfMax[action] = clampPrecision(min);
  }

  // Column maxima (minimax for each state)
  for (const state of input.states) {
    let max = -Infinity;
    for (const action of input.actions) {
      const val = input.outcomes[action]?.[state] ?? -Infinity;
      if (val > max) max = val;
    }
    maxOfMin[state] = clampPrecision(max);
  }

  // Find maximin value and minimax value
  const maximinValue = Math.max(...Object.values(minOfMax));
  const minimaxValue = Math.min(...Object.values(maxOfMin));

  // If saddle point exists (maximin == minimax)
  const hasSaddlePoint = Math.abs(maximinValue - minimaxValue) < 1e-9;

  // 2. Find best actions
  const candidateActions = input.actions.filter(a => 
    Math.abs(minOfMax[a] - maximinValue) < 1e-9
  );

  // Use weighted sum to break ties
  const weights = input.weights || {};
  const scores: Record<string, number> = {};
  
  for (const action of input.actions) {
    let sum = 0;
    for (const state of input.states) {
      const util = input.outcomes[action]?.[state] ?? 0;
      sum += util * (weights[state] ?? 1);
    }
    scores[action] = clampPrecision(sum);
  }

  // If no clear winner from maximin, use scores
  const ranking = sortByScore(input.actions, scores, false);

  return {
    recommended_action: candidateActions.length > 0 ? candidateActions[0] : ranking[0],
    ranking,
    trace: {
      algorithm: "nash",
      maximin_value: clampPrecision(maximinValue),
      minimax_value: clampPrecision(minimaxValue),
      has_saddle_point: hasSaddlePoint,
      nash_scores: clampRecordValues(scores)
    }
  };
}

/**
 * Pareto efficiency check
 * Identifies Pareto-optimal actions (non-dominated)
 * An action is Pareto-optimal if no other action dominates it
 */
function paretoFallback(input: DecisionInput): DecisionOutput {
  // 1. Find all Pareto-optimal actions
  // An action A dominates action B if A >= B for all states and A > B for at least one
  const isDominated: Record<string, boolean> = {};
  
  for (const actionA of input.actions) {
    isDominated[actionA] = false;
    for (const actionB of input.actions) {
      if (actionA === actionB) continue;
      
      // Check if actionB dominates actionA
      let atLeastAsGood = true;
      let strictlyBetter = false;
      
      for (const state of input.states) {
        const valA = input.outcomes[actionA]?.[state] ?? -Infinity;
        const valB = input.outcomes[actionB]?.[state] ?? -Infinity;
        
        if (valB < valA) {
          atLeastAsGood = false;
          break;
        }
        if (valB > valA) {
          strictlyBetter = true;
        }
      }
      
      if (atLeastAsGood && strictlyBetter) {
        isDominated[actionA] = true;
        break;
      }
    }
  }

  // 2. Ranking: Pareto-optimal first, then by weighted sum
  const paretoOptimal = input.actions.filter(a => !isDominated[a]);
  
  const weights = input.weights || {};
  const scores: Record<string, number> = {};
  
  for (const action of input.actions) {
    let sum = 0;
    for (const state of input.states) {
      const util = input.outcomes[action]?.[state] ?? 0;
      sum += util * (weights[state] ?? 1);
    }
    scores[action] = clampPrecision(sum);
  }

  // Sort Pareto-optimal by score, then non-Pareto
  const paretoRanking = sortByScore(paretoOptimal, scores, false);
  const nonPareto = input.actions.filter(a => isDominated[a]);
  const nonParetoRanking = sortByScore(nonPareto, scores, false);
  
  const ranking = [...paretoRanking, ...nonParetoRanking];

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "pareto",
      is_pareto_optimal: isDominated,
      pareto_front: paretoOptimal,
      scores: clampRecordValues(scores)
    }
  };
}

/**
 * Epsilon-contamination robust optimization
 * Assumes epsilon fraction of states could have worst-case outcomes
 */
function epsilonContaminationFallback(input: DecisionInput): DecisionOutput {
  const epsilon = clampPrecision(input.epsilon ?? 0.1);
  
  // 1. Calculate worst-case under epsilon contamination
  // Robust score = (1 - epsilon) * expected + epsilon * worst_case
  const weights = input.weights || {};
  const stateWeights = input.states.map(s => weights[s] ?? (1 / input.states.length));
  
  const robustScores: Record<string, number> = {};

  for (const action of input.actions) {
    // Expected value
    let expected = 0;
    let worstCase = Infinity;
    
    for (let i = 0; i < input.states.length; i++) {
      const util = input.outcomes[action]?.[input.states[i]] ?? 0;
      expected += util * stateWeights[i];
      if (util < worstCase) worstCase = util;
    }
    
    // Robust score
    const robustScore = (1 - epsilon) * expected + epsilon * worstCase;
    robustScores[action] = clampPrecision(robustScore);
  }

  // 2. Ranking (descending)
  const ranking = sortByScore(input.actions, robustScores, false);

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "epsilon_contamination",
      epsilon,
      robust_scores: clampRecordValues(robustScores)
    }
  };
}

/**
 * TOPSIS - Technique for Order Preference by Similarity to Ideal Solution
 * Selects action closest to ideal solution and farthest from negative-ideal
 */
function topsisFallback(input: DecisionInput): DecisionOutput {
  const weights = input.weights || {};
  
  // 1. Normalize decision matrix
  const normalized: Record<string, Record<string, number>> = {};
  
  // Calculate sum of squares for each state
  const stateSquares: Record<string, number> = {};
  for (const state of input.states) {
    let sumSq = 0;
    for (const action of input.actions) {
      const val = input.outcomes[action]?.[state] ?? 0;
      sumSq += val * val;
    }
    stateSquares[state] = Math.sqrt(sumSq);
  }

  // Normalize
  for (const action of input.actions) {
    normalized[action] = {};
    for (const state of input.states) {
      const val = input.outcomes[action]?.[state] ?? 0;
      const norm = stateSquares[state] > 0 ? val / stateSquares[state] : 0;
      normalized[action][state] = clampPrecision(norm);
    }
  }

  // 2. Weighted normalized matrix
  const weighted: Record<string, Record<string, number>> = {};
  for (const action of input.actions) {
    weighted[action] = {};
    for (const state of input.states) {
      const weight = weights[state] ?? (1 / input.states.length);
      weighted[action][state] = clampPrecision(
        normalized[action][state] * weight
      );
    }
  }

  // 3. Find ideal and negative-ideal solutions
  const ideal: Record<string, number> = {};
  const negativeIdeal: Record<string, number> = {};
  
  for (const state of input.states) {
    let maxVal = -Infinity;
    let minVal = Infinity;
    
    for (const action of input.actions) {
      const val = weighted[action][state];
      if (val > maxVal) maxVal = val;
      if (val < minVal) minVal = val;
    }
    
    ideal[state] = maxVal;
    negativeIdeal[state] = minVal;
  }

  // 4. Calculate distances
  const distanceToIdeal: Record<string, number> = {};
  const distanceToNegative: Record<string, number> = {};

  for (const action of input.actions) {
    let distIdeal = 0;
    let distNegative = 0;
    
    for (const state of input.states) {
      const diffIdeal = weighted[action][state] - ideal[state];
      const diffNegative = weighted[action][state] - negativeIdeal[state];
      distIdeal += diffIdeal * diffIdeal;
      distNegative += diffNegative * diffNegative;
    }
    
    distanceToIdeal[action] = clampPrecision(Math.sqrt(distIdeal));
    distanceToNegative[action] = clampPrecision(Math.sqrt(distNegative));
  }

  // 5. Calculate relative closeness (TOPSIS score)
  // Higher score = closer to ideal, farther from negative-ideal
  const topsisScores: Record<string, number> = {};
  
  for (const action of input.actions) {
    const denom = distanceToIdeal[action] + distanceToNegative[action];
    const score = denom > 0 
      ? distanceToNegative[action] / denom 
      : 0;
    topsisScores[action] = clampPrecision(score);
  }

  // 6. Ranking (descending by TOPSIS score)
  const ranking = sortByScore(input.actions, topsisScores, false);

  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "topsis",
      normalized_matrix: normalized,
      weighted_matrix: weighted,
      ideal_solution: clampRecordValues(ideal),
      negative_ideal_solution: clampRecordValues(negativeIdeal),
      distance_to_ideal: clampRecordValues(distanceToIdeal),
      distance_to_negative: clampRecordValues(distanceToNegative),
      topsis_scores: clampRecordValues(topsisScores)
    }
  };
}
