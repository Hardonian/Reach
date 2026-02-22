const { evaluateDecision, evaluateDecisionFallback, validateOutcomes, validateStructure, validateProbabilities } = require('../dist/index');
const assert = require('assert');

console.log("Running Parity Tests (WASM vs TS)...");

const fixtures = [
    {
        name: "Basic Minimax Regret",
        input: {
            actions: ["a1", "a2"],
            states: ["s1", "s2"],
            outcomes: {
                "a1": { "s1": 10, "s2": 5 },
                "a2": { "s1": 0, "s2": 20 }
            },
            algorithm: "minimax_regret"
        }
    },
    {
        name: "Basic Maximin",
        input: {
            actions: ["a1", "a2"],
            states: ["s1", "s2"],
            outcomes: {
                "a1": { "s1": 10, "s2": 0 },
                "a2": { "s1": 5, "s2": 5 }
            },
            algorithm: "maximin"
        }
    },
    {
        name: "Negative Values Maximin",
        input: {
            actions: ["a1", "a2"],
            states: ["s1", "s2"],
            outcomes: {
                "a1": { "s1": -10, "s2": -5 },
                "a2": { "s1": -20, "s2": -2 }
            },
            algorithm: "maximin"
        }
    },
    {
        name: "Tie Breaking (Lexicographic)",
        input: {
            actions: ["b", "a"],
            states: ["s1"],
            outcomes: {
                "a": { "s1": 10 },
                "b": { "s1": 10 }
            },
            algorithm: "minimax_regret"
        }
    },
    {
        name: "Weighted Sum",
        input: {
            actions: ["a1", "a2"],
            states: ["s1", "s2"],
            outcomes: {
                "a1": { "s1": 10, "s2": 5 }, // 10*0.6 + 5*0.4 = 6+2=8
                "a2": { "s1": 0, "s2": 20 }  // 0*0.6 + 20*0.4 = 8
            },
            weights: { "s1": 0.6, "s2": 0.4 },
            // Tie-break: a1 vs a2 -> a1 (lexicographic)
            algorithm: "weighted_sum"
        }
    },
    {
        name: "Strict Mode (Valid Weights)",
        input: {
            actions: ["a1"],
            states: ["s1", "s2"],
            outcomes: { "a1": { "s1": 10, "s2": 10 } },
            weights: { "s1": 0.5, "s2": 0.5 },
            algorithm: "weighted_sum",
            strict: true
        }
    },
    {
        name: "Weighted Sum (Unnormalized, Auto-Normalize)",
        input: {
            actions: ["a1", "a2"],
            states: ["s1", "s2"],
            outcomes: { "a1": { "s1": 10, "s2": 10 }, "a2": { "s1": 20, "s2": 0 } },
            // Sum = 10. Normalized: s1=0.2, s2=0.8
            weights: { "s1": 2, "s2": 8 }, 
            algorithm: "weighted_sum"
        }
    }
];

let passed = 0;
let failed = 0;

for (const fixture of fixtures) {
    try {
        console.log(`Testing: ${fixture.name}`);
        
        // 1. Run TS Fallback
        const tsResult = evaluateDecisionFallback(fixture.input);
        
        // 2. Run WASM (via main entry point)
        // Note: This assumes WASM is built and available. If not, evaluateDecision falls back to TS,
        // effectively testing TS vs TS. To verify WASM, ensure `npm run build:wasm` is run first.
        const wasmResult = evaluateDecision(fixture.input);

        // Normalize for comparison
        const tsObj = JSON.parse(JSON.stringify(tsResult));
        const wasmObj = JSON.parse(JSON.stringify(wasmResult));
        
        // Remove fingerprint from WASM object for comparison (TS fallback doesn't generate it)
        if (wasmObj.trace && wasmObj.trace.fingerprint) {
            delete wasmObj.trace.fingerprint;
        }
        if (tsObj.trace && tsObj.trace.fingerprint) {
             delete tsObj.trace.fingerprint;
        }

        // Deep strict equality check
        assert.deepStrictEqual(wasmObj, tsObj, "WASM and TS outputs mismatch");
        
        console.log("  PASS");
        passed++;
    } catch (e) {
        console.error(`  FAIL: ${e.message}`);
        // console.error("Expected:", JSON.stringify(tsResult, null, 2));
        // console.error("Actual:", JSON.stringify(wasmResult, null, 2));
        failed++;
    }
}

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);

// --- API Validation Tests ---
console.log("\nRunning API Validation Tests...");
const validationFixtures = [
    {
        name: "Validate Outcomes - Infinity",
        input: {
            actions: ["a1"],
            states: ["s1"],
            outcomes: { "a1": { "s1": Infinity } }
        },
        check: validateOutcomes,
        expectedError: "Utility value cannot be NaN or Infinity"
    },
    {
        name: "Validate Structure - Missing State",
        input: {
            actions: ["a1"],
            states: ["s1", "s2"],
            outcomes: { "a1": { "s1": 10 } } // s2 missing
        },
        check: validateStructure,
        expectedError: "Missing outcome for action 'a1' in state 's2'"
    },
    {
        name: "Validate Probabilities - Negative",
        input: {
            actions: ["a1"],
            states: ["s1"],
            outcomes: { "a1": { "s1": 10 } },
            weights: { "s1": -0.5 }
        },
        check: validateProbabilities,
        expectedError: "Probability value must be between 0.0 and 1.0"
    }
];

for (const fixture of validationFixtures) {
    try {
        console.log(`Testing Validation: ${fixture.name}`);
        fixture.check(fixture.input);
        console.error("  FAIL: Expected error but succeeded");
        process.exit(1);
    } catch (e) {
        if (e.message.includes(fixture.expectedError)) {
            console.log("  PASS");
        } else {
            console.error(`  FAIL: Error message mismatch.\n  Expected: ${fixture.expectedError}\n  Got: ${e.message}`);
            process.exit(1);
        }
    }
}