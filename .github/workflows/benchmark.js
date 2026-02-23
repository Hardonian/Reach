const { evaluateDecision, evaluateDecisionFallback } = require("../dist/index");
const { performance } = require("perf_hooks");

console.log("Running Decision Engine Benchmark (WASM vs TS)...");

// 1. Generate Large Input (100 actions x 100 states = 10,000 cells)
const ACTIONS = 100;
const STATES = 100;
const ITERATIONS = 50;

console.log(
  `Generating ${ACTIONS}x${STATES} matrix (${ACTIONS * STATES} cells)...`,
);

const actions = Array.from({ length: ACTIONS }, (_, i) => `action_${i}`);
const states = Array.from({ length: STATES }, (_, i) => `state_${i}`);
const outcomes = {};

actions.forEach((action) => {
  outcomes[action] = {};
  states.forEach((state) => {
    outcomes[action][state] = Math.random() * 100;
  });
});

const input = {
  actions,
  states,
  outcomes,
  algorithm: "minimax_regret",
};

// 2. Warmup
console.log("Warming up engines...");
try {
  evaluateDecision(input);
} catch (e) {
  console.error("WASM Warmup Failed", e);
}
evaluateDecisionFallback(input);

// 3. Benchmark TS Fallback
console.log(`Benchmarking TS Fallback (${ITERATIONS} iterations)...`);
const startTs = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  evaluateDecisionFallback(input);
}
const endTs = performance.now();
const avgTs = (endTs - startTs) / ITERATIONS;

// 4. Benchmark WASM
console.log(`Benchmarking WASM Engine (${ITERATIONS} iterations)...`);
const startWasm = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  evaluateDecision(input);
}
const endWasm = performance.now();
const avgWasm = (endWasm - startWasm) / ITERATIONS;

// 5. Report
console.log("\n=== RESULTS ===");
console.log(`TS Fallback: ${avgTs.toFixed(4)} ms/op`);
console.log(`WASM Engine: ${avgWasm.toFixed(4)} ms/op`);
console.log(`Speedup:     ${(avgTs / avgWasm).toFixed(2)}x`);
