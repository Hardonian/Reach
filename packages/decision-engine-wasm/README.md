# @reach/decision-engine-wasm

TypeScript wrapper for the decision-engine WASM module with automatic fallback support.

## Overview

This package provides a TypeScript interface to the Rust decision engine compiled to WebAssembly. It includes:

- **WASM bindings** for high-performance decision evaluation
- **Automatic fallback** to pure TypeScript implementation when WASM is unavailable
- **Deterministic outputs** with SHA-256 fingerprints
- **Full type definitions** for all input/output types

## Installation

```bash
npm install @reach/decision-engine-wasm
```

## Quick Start

```typescript
import { evaluateDecision, init } from '@reach/decision-engine-wasm';

// Initialize (optional, but recommended for WASM)
await init();

const result = evaluateDecision({
  actions: [
    { id: 'buy', label: 'Buy' },
    { id: 'sell', label: 'Sell' }
  ],
  scenarios: [
    { id: 'bull', probability: 0.6, adversarial: false },
    { id: 'bear', probability: 0.4, adversarial: true }
  ],
  outcomes: [
    ['buy', 'bull', 100],
    ['buy', 'bear', -50],
    ['sell', 'bull', -20],
    ['sell', 'bear', 30]
  ]
});

console.log('Recommended:', result.rankedActions[0].actionId);
console.log('Fingerprint:', result.determinismFingerprint);
console.log('Engine:', result.engine); // 'wasm' or 'fallback'
```

## API

### `init(options?: DecisionEngineOptions): Promise<boolean>`

Initialize the decision engine. Attempts to load the WASM module and falls back to TypeScript if unavailable.

**Options:**
- `forceFallback?: boolean` - Force use of the TypeScript implementation
- `wasmPath?: string` - Custom path to the WASM module

**Returns:** `true` if WASM is available, `false` if using fallback

### `evaluateDecision(input: DecisionInput): DecisionResult`

Evaluate a decision problem and return ranked actions with scores.

**Input:**
```typescript
interface DecisionInput {
  id?: string;
  actions: ActionOption[];
  scenarios: Scenario[];
  outcomes: [string, string, number][];
  constraints?: DecisionConstraint;
  evidence?: DecisionEvidence;
  meta?: DecisionMeta;
}
```

**Output:**
```typescript
interface DecisionResult extends DecisionOutput {
  engine: 'wasm' | 'fallback';
  engineVersion: string;
}

interface DecisionOutput {
  rankedActions: RankedAction[];
  determinismFingerprint: string;
  trace: DecisionTrace;
}
```

### `computeFingerprint(input: DecisionInput): string`

Compute the SHA-256 fingerprint for a decision input. The fingerprint is deterministic - the same input always produces the same fingerprint.

**Returns:** 64-character lowercase hex string

### `getEngineVersion(): string`

Get the current engine version.

### `isWasmEnabled(): boolean`

Check if WASM is currently enabled.

## Determinism Guarantees

The decision engine guarantees **byte-stable deterministic outputs**:

1. **Identical inputs → Identical outputs**: Same `DecisionInput` always produces identical `DecisionOutput`
2. **Canonical JSON**: Object keys sorted deeply, numbers normalized to 1e-9 precision
3. **Stable SHA-256 fingerprints**: 64-character hex string computed from canonical JSON
4. **Tie-breaking**: Actions sorted lexicographically by `actionId` for stable rankings
5. **No runtime entropy**: No `Date.now()`, `Math.random()`, or UUID generation

## Algorithms

### Worst-case (Maximin)

For each action, find the minimum utility across all scenarios. The action with the maximum of these minimums is preferred for risk-averse decisions.

### Minimax Regret

For each scenario, compute the best possible utility. Regret = best - actual. For each action, find the maximum regret. The action with the minimum of these maximum regrets is preferred.

### Adversarial Robustness

For each action, find the minimum utility across adversarial scenarios only. This measures robustness against worst-case adversarial conditions.

### Composite Score

Weighted combination of all metrics:
- Worst-case: 40%
- Minimax regret: 40%
- Adversarial: 20%

## Building WASM

Prerequisites:
- Rust toolchain (rustup)
- wasm-pack (`cargo install wasm-pack`)

```bash
# Build WASM module
cd packages/decision-engine-wasm
npm run build:wasm

# Build TypeScript
npm run build

# Run tests
npm test
```

## Testing

```bash
# Run parity tests
npm run test:parity

# Run all tests
npm test
```

## Error Handling

Errors are returned with structured codes:

| Code | Description |
|------|-------------|
| `E_SCHEMA` | Invalid JSON schema |
| `E_INVALID_INPUT` | Invalid input values |
| `E_NOT_FOUND` | Referenced entity not found |
| `E_INTERNAL` | Internal error |

```typescript
import { evaluateDecision, DecisionEngineError } from '@reach/decision-engine-wasm';

try {
  const result = evaluateDecision(invalidInput);
} catch (error) {
  if (error instanceof DecisionEngineError) {
    console.log('Code:', error.code);
    console.log('Message:', error.message);
    console.log('Details:', error.details);
  }
}
```

## Related Documentation

- [CANONICALIZATION_SPEC.md](../../docs/CANONICALIZATION_SPEC.md) - Canonical JSON specification
- [DETERMINISM_SPEC.md](../../docs/DETERMINISM_SPEC.md) - Determinism requirements
- [Rust Implementation](../../crates/decision-engine/README.md) - Core engine documentation

## License

MIT
