import { evaluateDecision, DecisionInput, DecisionOutput, getDecisionEngine } from './src/decision/engineAdapter';

/**
 * Evaluates a decision using Minimax Regret.
 * Uses the configured engine (TS reference or WASM).
 */
export { evaluateDecision, DecisionInput, DecisionOutput, getDecisionEngine };

// Usage Example (for verification)
/*
const input = {
  actions: ["a1", "a2"],
  states: ["s1", "s2"],
  outcomes: { "a1": {"s1": 10, "s2": 5}, "a2": {"s1": 0, "s2": 20} }
};
console.log(evaluateDecision(input));
*/