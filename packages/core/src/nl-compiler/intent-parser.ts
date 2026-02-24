import type { GovernanceMemoryEntry, RolloutMode, ThresholdOperator } from "./types.js";

export interface ParsedThreshold {
  metric: string;
  operator: ThresholdOperator;
  value: number;
  source: "intent" | "memory" | "default";
}

export interface ParsedGovernanceIntent {
  intents: string[];
  rationale: string[];
  thresholds: ParsedThreshold[];
  requireProvenance: boolean;
  requireReplay: boolean;
  requireModelRiskBlock: boolean;
  requireCiEnforcement: boolean;
  rolloutHint?: RolloutMode;
}

interface MemoryDefaults {
  evaluationMin?: number;
  hallucinationMax?: number;
  costDeltaMaxPct?: number;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function chooseMemoryNumber(memory: GovernanceMemoryEntry[], keys: string[]): number | undefined {
  let winner: { confidence: number; value: number } | null = null;

  for (const entry of memory) {
    const confidence = clampConfidence(entry.confidence);
    if (confidence <= 0) continue;

    for (const key of keys) {
      const candidate = entry.content[key];
      if (typeof candidate !== "number" || !Number.isFinite(candidate)) continue;

      if (!winner || confidence > winner.confidence) {
        winner = { confidence, value: candidate };
      }
    }
  }

  return winner?.value;
}

function extractMemoryDefaults(memory: GovernanceMemoryEntry[]): MemoryDefaults {
  return {
    evaluationMin: chooseMemoryNumber(memory, [
      "evaluation_min",
      "evaluationScoreMin",
      "preferred_eval_threshold",
    ]),
    hallucinationMax: chooseMemoryNumber(memory, [
      "hallucination_max",
      "hallucinationRiskMax",
      "safety_max_hallucination",
    ]),
    costDeltaMaxPct: chooseMemoryNumber(memory, ["cost_delta_pct_max", "costSensitivityPct"]),
  };
}

function normalizeIntent(intent: string): string {
  return intent.replace(/\s+/g, " ").trim().toLowerCase();
}

function parseNumericComparator(
  normalized: string,
  metric: string,
  regexes: RegExp[],
): ParsedThreshold | null {
  for (const regex of regexes) {
    const match = normalized.match(regex);
    if (!match) continue;

    const parsed = Number.parseFloat(match.at(-1) ?? "");
    if (!Number.isFinite(parsed)) continue;

    return {
      metric,
      operator: regex.source.includes("below") || regex.source.includes("max") ? "<=" : ">=",
      value: parsed,
      source: "intent",
    };
  }

  return null;
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

export function parseGovernanceIntent(
  intent: string,
  memory: GovernanceMemoryEntry[],
): ParsedGovernanceIntent {
  const normalized = normalizeIntent(intent);
  const defaults = extractMemoryDefaults(memory);

  const intents = new Set<string>();
  const rationale = new Set<string>();
  const thresholds: ParsedThreshold[] = [];

  const evalThreshold = parseNumericComparator(normalized, "evaluation_score", [
    /(?:evaluation|eval|score)(?:\s+score)?\s*(?:>=|=>|at least|minimum|min)\s*(\d+(?:\.\d+)?)/,
    /deploy(?:s|ed|ing)?\s+unless\s+(?:evaluation|eval|score)\s*(?:>=|=>)?\s*(\d+(?:\.\d+)?)/,
  ]);

  if (evalThreshold) {
    intents.add("evaluation-threshold");
    thresholds.push(evalThreshold);
    rationale.add(`Parsed evaluation threshold ${evalThreshold.operator} ${evalThreshold.value}.`);
  }

  const hallucinationThreshold = parseNumericComparator(normalized, "hallucination_risk", [
    /hallucination\s+risk\s*(?:<=|=<|below|max(?:imum)?)\s*(\d+(?:\.\d+)?)/,
    /block.*hallucination\s+risk\s*(?:>|>=|above)\s*(\d+(?:\.\d+)?)/,
  ]);

  if (hallucinationThreshold) {
    intents.add("hallucination-threshold");
    thresholds.push(hallucinationThreshold);
    rationale.add(
      `Parsed hallucination risk threshold ${hallucinationThreshold.operator} ${hallucinationThreshold.value}.`,
    );
  }

  if (!evalThreshold && includesAny(normalized, ["make this safer", "safer", "increase safety"])) {
    const fallback = defaults.evaluationMin ?? 0.9;
    thresholds.push({
      metric: "evaluation_score",
      operator: ">=",
      value: fallback,
      source: defaults.evaluationMin ? "memory" : "default",
    });
    intents.add("safety-default");
    rationale.add(
      defaults.evaluationMin
        ? `Applied memory-backed evaluation baseline ${fallback}.`
        : `Applied default evaluation baseline ${fallback}.`,
    );
  }

  if (
    !hallucinationThreshold &&
    includesAny(normalized, ["make this safer", "hallucination", "reduce hallucination"])
  ) {
    const fallback = defaults.hallucinationMax ?? 0.1;
    thresholds.push({
      metric: "hallucination_risk",
      operator: "<=",
      value: fallback,
      source: defaults.hallucinationMax ? "memory" : "default",
    });
    intents.add("safety-hallucination-default");
    rationale.add(
      defaults.hallucinationMax
        ? `Applied memory-backed hallucination cap ${fallback}.`
        : `Applied default hallucination cap ${fallback}.`,
    );
  }

  const requireProvenance = includesAny(normalized, [
    "require provenance",
    "provenance",
    "generated artifacts",
    "artifact lineage",
  ]);
  if (requireProvenance) {
    intents.add("provenance-required");
    rationale.add("Detected provenance requirement for generated artifacts.");
  }

  const requireReplay = includesAny(normalized, [
    "replay",
    "deterministic",
    "which agent caused",
    "regression",
  ]);
  if (requireReplay) {
    intents.add("replay-required");
    rationale.add("Detected replay/debug intent; enabling strict replay checks.");
  }

  const requireModelRiskBlock = includesAny(normalized, [
    "block model changes",
    "model changes",
    "switching to a cheaper model",
    "risk",
  ]);
  if (requireModelRiskBlock) {
    intents.add("model-risk-guard");
    rationale.add("Detected model-risk guard requirement.");
  }

  const requireCiEnforcement =
    includesAny(normalized, ["pr", "pull request", "deploy", "ci", "gate"]) ||
    thresholds.length > 0;

  if (requireCiEnforcement) {
    intents.add("ci-enforcement");
    rationale.add("Detected CI enforcement intent; workflow gate generation enabled.");
  }

  let rolloutHint: RolloutMode | undefined;
  if (includesAny(normalized, ["dry run", "dry-run", "preview", "simulate"])) {
    rolloutHint = "dry-run";
  } else if (includesAny(normalized, ["enforce", "hard fail", "block immediately"])) {
    rolloutHint = "enforced";
  }

  return {
    intents: Array.from(intents).sort(),
    rationale: Array.from(rationale).sort(),
    thresholds,
    requireProvenance,
    requireReplay,
    requireModelRiskBlock,
    requireCiEnforcement,
    rolloutHint,
  };
}
