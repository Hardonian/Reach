import { stableStringify } from "./compiler";
import type { GovernanceSpec } from "./compiler";

export interface GovernanceSpecDiff {
  hasChanges: boolean;
  summary: string;
  gateDelta: {
    added: number;
    removed: number;
    changed: number;
  };
  thresholdDelta: {
    added: number;
    removed: number;
    changed: number;
  };
}

function toMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function countChanged<T extends { id: string }>(next: T[], prev: T[]): number {
  const previous = toMap(prev);
  let changed = 0;

  for (const item of next) {
    const existing = previous.get(item.id);
    if (!existing) continue;
    if (stableStringify(existing) !== stableStringify(item)) {
      changed += 1;
    }
  }

  return changed;
}

export function diffGovernanceSpec(
  previous: GovernanceSpec | null,
  next: GovernanceSpec,
): GovernanceSpecDiff {
  if (!previous) {
    return {
      hasChanges: true,
      summary: "Initial governance spec draft.",
      gateDelta: {
        added: next.gates.length,
        removed: 0,
        changed: 0,
      },
      thresholdDelta: {
        added: next.thresholds.length,
        removed: 0,
        changed: 0,
      },
    };
  }

  const nextGates = toMap(next.gates);
  const prevGates = toMap(previous.gates);
  const nextThresholds = toMap(next.thresholds);
  const prevThresholds = toMap(previous.thresholds);

  const gateAdded = next.gates.filter((gate) => !prevGates.has(gate.id)).length;
  const gateRemoved = previous.gates.filter((gate) => !nextGates.has(gate.id)).length;
  const gateChanged = countChanged(next.gates, previous.gates);

  const thresholdAdded = next.thresholds.filter(
    (threshold) => !prevThresholds.has(threshold.id),
  ).length;
  const thresholdRemoved = previous.thresholds.filter(
    (threshold) => !nextThresholds.has(threshold.id),
  ).length;
  const thresholdChanged = countChanged(next.thresholds, previous.thresholds);

  const hasChanges =
    gateAdded > 0 ||
    gateRemoved > 0 ||
    gateChanged > 0 ||
    thresholdAdded > 0 ||
    thresholdRemoved > 0 ||
    thresholdChanged > 0 ||
    previous.rolloutMode !== next.rolloutMode ||
    stableStringify(previous.replayPolicy ?? null) !== stableStringify(next.replayPolicy ?? null) ||
    stableStringify(previous.provenancePolicy ?? null) !==
      stableStringify(next.provenancePolicy ?? null);

  const summary = hasChanges
    ? `Gates +${gateAdded}/-${gateRemoved} (${gateChanged} changed), thresholds +${thresholdAdded}/-${thresholdRemoved} (${thresholdChanged} changed).`
    : "No spec changes.";

  return {
    hasChanges,
    summary,
    gateDelta: {
      added: gateAdded,
      removed: gateRemoved,
      changed: gateChanged,
    },
    thresholdDelta: {
      added: thresholdAdded,
      removed: thresholdRemoved,
      changed: thresholdChanged,
    },
  };
}
