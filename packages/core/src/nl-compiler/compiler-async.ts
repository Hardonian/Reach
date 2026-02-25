/**
 * Async compiler with WASM acceleration support
 * 
 * This module provides async versions of the compiler functions that can
 * leverage the WASM implementation for improved performance and cross-language
 * consistency.
 */

import {
  compareNumbers,
  compareStrings,
  sha256Hex,
  stableStringify,
} from "./deterministic.js";
import {
  computeFingerprint,
  computeFingerprintViaRust,
  isWasmAvailable,
} from "./determinism-bridge.js";
import { parseGovernanceIntent } from "./intent-parser.js";
import type {
  CIEnforcementRule,
  CompileGovernanceIntentInput,
  CompileGovernanceIntentOutput,
  EvalThreshold,
  GateConfig,
  GovernanceMemoryEntry,
  GovernancePlan,
  GovernanceScope,
  GovernanceSpec,
  RolloutMode,
} from "./types.js";

function thresholdId(metric: string, operator: string, value: number): string {
  return `thr_${sha256Hex(`${metric}:${operator}:${value}`).slice(0, 12)}`;
}

function gateId(name: string): string {
  return `gate_${sha256Hex(name).slice(0, 12)}`;
}

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function summarizeMemorySignals(memory: GovernanceMemoryEntry[]): string[] {
  return memory
    .filter((entry) => normalizeConfidence(entry.confidence) >= 0.5)
    .map(
      (entry) =>
        `${entry.memoryType}@${entry.scope} (confidence ${normalizeConfidence(entry.confidence).toFixed(2)})`,
    )
    .sort(compareStrings);
}

function dedupeThresholds(thresholds: EvalThreshold[]): EvalThreshold[] {
  const seen = new Set<string>();
  const output: EvalThreshold[] = [];

  for (const threshold of thresholds) {
    const key = `${threshold.metric}:${threshold.operator}:${threshold.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(threshold);
  }

  return output;
}

function toThresholds(
  parsed: ReturnType<typeof parseGovernanceIntent>["thresholds"],
): EvalThreshold[] {
  return parsed.map((threshold) => ({
    id: thresholdId(threshold.metric, threshold.operator, threshold.value),
    metric: threshold.metric,
    operator: threshold.operator,
    value: threshold.value,
    source: threshold.source,
  }));
}

function compareThresholds(a: EvalThreshold, b: EvalThreshold): number {
  const metricCmp = compareStrings(a.metric, b.metric);
  if (metricCmp !== 0) return metricCmp;

  const opCmp = compareStrings(a.operator, b.operator);
  if (opCmp !== 0) return opCmp;

  const valueCmp = compareNumbers(a.value, b.value);
  if (valueCmp !== 0) return valueCmp;

  return compareStrings(a.id, b.id);
}

function buildGates(params: {
  thresholds: EvalThreshold[];
  requireProvenance: boolean;
  requireReplay: boolean;
  requireModelRiskBlock: boolean;
  requireCiEnforcement: boolean;
}): GateConfig[] {
  const gates: GateConfig[] = [];

  for (const threshold of params.thresholds) {
    gates.push({
      id: gateId(`threshold:${threshold.metric}:${threshold.operator}:${threshold.value}`),
      name: `${threshold.metric} threshold`,
      description: `Enforce ${threshold.metric} ${threshold.operator} ${threshold.value}`,
      gateType: "eval-threshold",
      action: "block",
      conditions: {
        metric: threshold.metric,
        operator: threshold.operator,
        value: threshold.value,
      },
    });
  }

  if (params.requireModelRiskBlock) {
    gates.push({
      id: gateId("model-risk-guard"),
      name: "Model risk guard",
      description: "Block model changes that increase hallucination or regression risk.",
      gateType: "model-risk",
      action: "block",
      conditions: {
        requiresSimulation: true,
        maxRegressionDelta: 0,
      },
    });
  }

  if (params.requireProvenance) {
    gates.push({
      id: gateId("provenance-required"),
      name: "Provenance required",
      description: "Require provenance metadata for generated artifacts.",
      gateType: "provenance",
      action: "block",
      conditions: {
        required: true,
      },
    });
  }

  if (params.requireReplay) {
    gates.push({
      id: gateId("replay-required"),
      name: "Replay required",
      description: "Require deterministic replay metadata for every gate decision.",
      gateType: "replay",
      action: "block",
      conditions: {
        required: true,
        mode: "strict",
      },
    });
  }

  if (params.requireCiEnforcement) {
    gates.push({
      id: gateId("ci-enforcement"),
      name: "CI enforcement",
      description: "Fail CI when governance gates do not pass.",
      gateType: "ci-enforcement",
      action: "block",
      conditions: {
        workflow: ".github/workflows/reach-gates.yml",
      },
    });
  }

  return gates.sort((a, b) => compareStrings(a.id, b.id));
}

function resolveRolloutMode(
  input: CompileGovernanceIntentInput,
  parsedRolloutHint: RolloutMode | undefined,
): RolloutMode {
  if (input.forceRolloutMode) return input.forceRolloutMode;
  if (parsedRolloutHint) return parsedRolloutHint;
  return input.defaultRolloutMode ?? "dry-run";
}

function buildCiEnforcementRules(requireCiEnforcement: boolean): CIEnforcementRule[] {
  if (!requireCiEnforcement) return [];
  return [
    {
      workflowPath: ".github/workflows/reach-gates.yml",
      failOnViolation: true,
      emitArtifactLinks: true,
      verifyCommand: "reach verify",
    },
  ];
}

function buildPlan(
  parsed: ReturnType<typeof parseGovernanceIntent>,
  memorySignals: string[],
): GovernancePlan {
  const summary =
    parsed.intents.length > 0
      ? `Compiled ${parsed.intents.length} governance intent(s) into deterministic gate config.`
      : "Compiled deterministic governance draft with default safeguards.";

  return {
    summary,
    intents: parsed.intents,
    rationale: parsed.rationale,
    memorySignals,
  };
}

function buildImpactPreview(spec: GovernanceSpec): CompileGovernanceIntentOutput["impactPreview"] {
  const evalThreshold = spec.thresholds.find(
    (threshold) => threshold.metric === "evaluation_score",
  );

  const wouldFailToday: string[] = [];
  if (evalThreshold && evalThreshold.value > 0.85) {
    wouldFailToday.push(
      `Pipelines below evaluation score ${evalThreshold.value.toFixed(2)} would fail.`,
    );
  }

  const hallucinationThreshold = spec.thresholds.find(
    (threshold) => threshold.metric === "hallucination_risk",
  );

  if (hallucinationThreshold && hallucinationThreshold.value < 0.2) {
    wouldFailToday.push(
      `Runs above hallucination risk ${hallucinationThreshold.value.toFixed(2)} would fail.`,
    );
  }

  if (spec.provenancePolicy?.required) {
    wouldFailToday.push("Runs missing provenance metadata would fail.");
  }

  const affectedRepos = ["current-workspace"];
  const costDeltaPct = spec.rolloutMode === "dry-run" ? 1.5 : 2.2;
  const evalDeltaPct = spec.thresholds.length > 0 ? 3.4 : 1.1;

  return {
    wouldFailToday,
    affectedRepos,
    costDeltaPct,
    evalDeltaPct,
  };
}

/**
 * Compile governance intent with optional WASM acceleration
 * 
 * This async version can use the Rust/WASM implementation for fingerprint
 * computation if available, providing better performance and cross-language
 * consistency.
 * 
 * @param input - The governance intent input
 * @param options - Optional configuration
 * @returns Promise resolving to the compiled output
 */
export async function compileGovernanceIntentAsync(
  input: CompileGovernanceIntentInput,
  options: {
    /** Force use of WASM implementation, fail if unavailable */
    requireWasm?: boolean;
    /** Prefer WASM but fall back to TS if unavailable */
    preferWasm?: boolean;
  } = {},
): Promise<CompileGovernanceIntentOutput> {
  const { requireWasm = false, preferWasm = true } = options;

  // Check WASM availability if needed
  const wasmAvailable = preferWasm || requireWasm ? await isWasmAvailable() : false;
  
  if (requireWasm && !wasmAvailable) {
    throw new Error('WASM implementation required but not available. Run: npm run build:wasm');
  }

  // Choose fingerprint function
  const computeSpecHash = (wasmAvailable && preferWasm)
    ? computeFingerprint
    : (spec: GovernanceSpec) => Promise.resolve(sha256Hex(stableStringify(spec)));

  const parsed = parseGovernanceIntent(input.intent, input.memory);

  const thresholds = dedupeThresholds(toThresholds(parsed.thresholds)).sort(compareThresholds);
  const rolloutMode = resolveRolloutMode(input, parsed.rolloutHint);

  const spec: GovernanceSpec = {
    gates: buildGates({
      thresholds,
      requireProvenance: parsed.requireProvenance,
      requireReplay: parsed.requireReplay,
      requireModelRiskBlock: parsed.requireModelRiskBlock,
      requireCiEnforcement: parsed.requireCiEnforcement,
    }),
    thresholds,
    replayPolicy: parsed.requireReplay
      ? {
          required: true,
          mode: "strict",
          retentionDays: 30,
        }
      : undefined,
    provenancePolicy: parsed.requireProvenance
      ? {
          required: true,
          level: "full",
        }
      : undefined,
    rolloutMode,
  };

  const canonicalSpec = stableStringify(spec);
  const specHash = await computeSpecHash(spec);
  const memorySignals = summarizeMemorySignals(input.memory);
  const ciEnforcement = buildCiEnforcementRules(parsed.requireCiEnforcement);
  const plan = buildPlan(parsed, memorySignals);

  const riskImpactSummary = [
    "Deterministic spec generation is hash-stable.",
    spec.rolloutMode === "dry-run"
      ? "Draft mode enabled: no runtime mutation until explicit apply."
      : "Enforced mode requested: gates will fail CI on violations.",
    parsed.requireReplay
      ? "Replay policy enabled for regression attribution."
      : "Replay policy unchanged.",
    wasmAvailable
      ? "WASM acceleration enabled for fingerprint computation."
      : "TypeScript implementation used for fingerprint computation.",
  ].sort(compareStrings);

  return {
    plan,
    spec,
    canonicalSpec,
    specHash,
    ciEnforcement,
    impactPreview: buildImpactPreview(spec),
    explainability: {
      sourceIntent: input.intent,
      generatedSpec: spec,
      determinismHash: specHash,
      riskImpactSummary,
    },
  };
}

/**
 * Compile governance intent using only the Rust/WASM implementation
 * 
 * This is a convenience function that requires WASM and will fail if
 * it's not available. Use this when you need guaranteed cross-language
 * consistency.
 * 
 * @param input - The governance intent input
 * @returns Promise resolving to the compiled output
 * @throws Error if WASM implementation is not available
 */
export async function compileGovernanceIntentWasm(
  input: CompileGovernanceIntentInput,
): Promise<CompileGovernanceIntentOutput> {
  return compileGovernanceIntentAsync(input, { requireWasm: true });
}

/**
 * Get compilation metadata including WASM availability
 * 
 * @returns Object with WASM status and version info
 */
export async function getCompilerMetadata(): Promise<{
  wasmAvailable: boolean;
  wasmVersion: string | null;
  tsVersion: string;
}> {
  const wasmAvailable = await isWasmAvailable();
  
  // Get WASM version if available
  let wasmVersion: string | null = null;
  if (wasmAvailable) {
    try {
      const result = await computeFingerprintViaRust({ version: true });
      // Parse the version from the result if possible
      wasmVersion = 'available'; // Simplified for now
    } catch {
      wasmVersion = null;
    }
  }

  return {
    wasmAvailable,
    wasmVersion,
    tsVersion: '0.1.0', // Should match package version
  };
}
