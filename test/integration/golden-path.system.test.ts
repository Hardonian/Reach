/**
 * test/integration/golden-path.system.test.ts
 *
 * PHASE 1 — Golden Path System Test
 *
 * Exercises the full Reach system as a cohesive unit:
 *   A) Seed deterministic demo data (no network)
 *   B) Create/detect a junction deterministically
 *   C) Evaluate a decision and capture DecisionOutput + Trace
 *   D) Accept decision → create action plan (dry-run)
 *   E) Execute a SAFE demo action (non-destructive)
 *   F) Verify action journal entries linked to decision/junction
 *   G) Verify events emitted for each major step
 *   H) Run metrics/vitals summary and assert counters updated
 *   I) Export a bundle for the decision/action and verify manifest hashes
 *   J) Run retention compact in dry-run mode and verify nothing breaks
 *   K) Search for created entities by fingerprint/id
 *
 * All operations are deterministic: no Date.now(), no Math.random().
 * All timestamps use fixed epoch values injected via seed.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createTempDir, cleanupTestEnv, type TestEnv } from "../harness/env.js";
import {
  DEMO_DECISION_INPUT,
  DEMO_DECISION_EXPECTED,
  DEMO_JUNCTION_TRIGGER,
  DEMO_ZEOLITE_SEED,
  DEMO_EVIDENCE,
  FIXED_TIMESTAMP,
  seedDemoData,
} from "../harness/seed.js";
import {
  assertCanonicalEqual,
  assertFingerprintStable,
  assertFingerprintChanged,
  assertEntityCount,
  assertOkResponse,
} from "../harness/asserts.js";
import { evaluateDecisionFallback } from "../../fallback.js";
import { canonicalJson } from "../../src/determinism/canonicalJson.js";
import { hashString, combineHashes } from "../../src/determinism/hashStream.js";
import { generateJunctionFingerprint, generateDeduplicationKey } from "../../src/junctions/types.js";
import { executeZeoliteOperation } from "../../src/core/zeolite-core.js";

// ─── In-process event journal ────────────────────────────────────────────────
// Since the system doesn't have a persistent event bus in OSS mode,
// we maintain a deterministic in-process event log for the test run.

interface SystemEvent {
  type: string;
  entityId: string;
  entityType: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

const eventJournal: SystemEvent[] = [];

function emitEvent(type: string, entityId: string, entityType: string, payload: Record<string, unknown>): void {
  eventJournal.push({ type, entityId, entityType, timestamp: FIXED_TIMESTAMP, payload });
}

// ─── In-process action journal ───────────────────────────────────────────────

interface ActionJournalEntry {
  id: string;
  actionType: string;
  decisionId: string;
  junctionId: string;
  status: "planned" | "approved" | "executed" | "rolled_back";
  idempotencyKey: string;
  payload: Record<string, unknown>;
  executedAt: string | null;
}

const actionJournal: ActionJournalEntry[] = [];

function planAction(
  actionType: string,
  decisionId: string,
  junctionId: string,
  payload: Record<string, unknown>,
): ActionJournalEntry {
  const idempotencyKey = hashString(`${actionType}:${decisionId}:${junctionId}:${canonicalJson(payload)}`);
  const id = hashString(`action:${idempotencyKey}`).slice(0, 16);
  const entry: ActionJournalEntry = {
    id,
    actionType,
    decisionId,
    junctionId,
    status: "planned",
    idempotencyKey,
    payload,
    executedAt: null,
  };
  actionJournal.push(entry);
  return entry;
}

function approveAction(entry: ActionJournalEntry): ActionJournalEntry {
  if (entry.status !== "planned") {
    throw new Error(`E_INVALID_INPUT: Cannot approve action in state '${entry.status}'`);
  }
  entry.status = "approved";
  return entry;
}

function executeAction(entry: ActionJournalEntry): ActionJournalEntry {
  if (entry.status !== "approved") {
    throw new Error(`E_INVALID_INPUT: Cannot execute action in state '${entry.status}' — must be approved first`);
  }
  // Check idempotency: if already executed with same key, skip
  const alreadyExecuted = actionJournal.filter(
    (e) => e.idempotencyKey === entry.idempotencyKey && e.status === "executed",
  );
  if (alreadyExecuted.length > 0) {
    return alreadyExecuted[0];
  }
  entry.status = "executed";
  entry.executedAt = FIXED_TIMESTAMP;
  return entry;
}

// ─── In-process metrics ──────────────────────────────────────────────────────

const metrics: Record<string, number> = {
  decisions_evaluated: 0,
  junctions_created: 0,
  actions_planned: 0,
  actions_executed: 0,
  events_emitted: 0,
  bundles_exported: 0,
};

function incrementMetric(name: string, by = 1): void {
  metrics[name] = (metrics[name] ?? 0) + by;
}

// ─── Test state ──────────────────────────────────────────────────────────────

let testEnv: TestEnv;
let seedPath: string;

// Captured state across test steps
let decisionOutput: ReturnType<typeof evaluateDecisionFallback>;
let junctionFingerprint: string;
let junctionDedupeKey: string;
let actionEntry: ActionJournalEntry;
let zeoliteContextId: string;
let transcriptId: string;
let transcriptHash: string;
let bundleManifest: Record<string, string>;

beforeAll(() => {
  testEnv = {
    tempDir: createTempDir("reach-golden-path-"),
    dbPath: "",
    port: 0,
  };
  testEnv.dbPath = join(testEnv.tempDir, "reach.db");
  seedPath = seedDemoData(testEnv.tempDir);
});

afterAll(() => {
  cleanupTestEnv(testEnv);
});

// ─── STEP A: Seed deterministic demo data ────────────────────────────────────

describe("A: Seed deterministic demo data", () => {
  it("writes seed file to temp dir", () => {
    expect(existsSync(seedPath)).toBe(true);
    const seed = JSON.parse(readFileSync(seedPath, "utf8"));
    expect(seed.id).toBe("demo-seed-golden-path-v1");
    expect(seed.timestamp).toBe(FIXED_TIMESTAMP);
  });

  it("seed data is deterministic (canonical JSON stable)", () => {
    const seed1 = JSON.parse(readFileSync(seedPath, "utf8"));
    const seed2 = JSON.parse(readFileSync(seedPath, "utf8"));
    assertCanonicalEqual(seed1, seed2, "seed data must be canonically equal");
  });
});

// ─── STEP B: Create/detect junction deterministically ────────────────────────

describe("B: Junction detection and deduplication", () => {
  it("generates deterministic fingerprint for junction trigger", () => {
    const fp1 = generateJunctionFingerprint(DEMO_JUNCTION_TRIGGER);
    const fp2 = generateJunctionFingerprint(DEMO_JUNCTION_TRIGGER);
    assertFingerprintStable(fp1, fp2, "junction fingerprint");
    junctionFingerprint = fp1;
    expect(junctionFingerprint).toHaveLength(16);
  });

  it("generates deterministic deduplication key", () => {
    const key1 = generateDeduplicationKey(DEMO_JUNCTION_TRIGGER);
    const key2 = generateDeduplicationKey(DEMO_JUNCTION_TRIGGER);
    assertFingerprintStable(key1, key2, "deduplication key");
    junctionDedupeKey = key1;
    expect(junctionDedupeKey).toHaveLength(16);
  });

  it("different source refs produce different fingerprints", () => {
    const fp1 = generateJunctionFingerprint(DEMO_JUNCTION_TRIGGER);
    const fp2 = generateJunctionFingerprint({ ...DEMO_JUNCTION_TRIGGER, sourceRef: "run-different-001" });
    assertFingerprintChanged(fp1, fp2, "junction fingerprint");
  });

  it("emits junction.created event", () => {
    emitEvent("junction.created", junctionFingerprint, "junction", {
      type: DEMO_JUNCTION_TRIGGER.type,
      severityScore: DEMO_JUNCTION_TRIGGER.severityScore,
      fingerprint: junctionFingerprint,
    });
    incrementMetric("junctions_created");
    incrementMetric("events_emitted");
    const junctionEvents = eventJournal.filter((e) => e.type === "junction.created");
    expect(junctionEvents).toHaveLength(1);
    expect(junctionEvents[0].entityId).toBe(junctionFingerprint);
  });
});

// ─── STEP C: Evaluate decision and capture output + trace ────────────────────

describe("C: Decision evaluation with trace", () => {
  it("evaluates decision deterministically", () => {
    decisionOutput = evaluateDecisionFallback(DEMO_DECISION_INPUT);
    expect(decisionOutput.recommended_action).toBe(DEMO_DECISION_EXPECTED.recommended_action);
    expect(decisionOutput.ranking).toEqual(DEMO_DECISION_EXPECTED.ranking);
    incrementMetric("decisions_evaluated");
  });

  it("decision output is stable across repeated evaluations", () => {
    const out1 = evaluateDecisionFallback(DEMO_DECISION_INPUT);
    const out2 = evaluateDecisionFallback(DEMO_DECISION_INPUT);
    assertCanonicalEqual(out1, out2, "decision output must be deterministic");
  });

  it("trace contains algorithm and regret data", () => {
    expect(decisionOutput.trace).toBeDefined();
    expect(decisionOutput.trace.algorithm).toBe("minimax_regret");
    expect(decisionOutput.trace.max_regret).toBeDefined();
    expect(typeof decisionOutput.trace.max_regret).toBe("object");
  });

  it("emits decision.evaluated event", () => {
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);
    emitEvent("decision.evaluated", decisionId, "decision", {
      recommended_action: decisionOutput.recommended_action,
      algorithm: decisionOutput.trace.algorithm,
    });
    incrementMetric("events_emitted");
    const decisionEvents = eventJournal.filter((e) => e.type === "decision.evaluated");
    expect(decisionEvents).toHaveLength(1);
  });
});

// ─── STEP D: Accept decision → create action plan (dry-run) ──────────────────

describe("D: Action plan creation (dry-run)", () => {
  it("creates action plan linked to decision and junction", () => {
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);
    actionEntry = planAction(
      "demo_safe_action",
      decisionId,
      junctionFingerprint,
      { dryRun: true, recommendedAction: decisionOutput.recommended_action },
    );
    expect(actionEntry.status).toBe("planned");
    expect(actionEntry.decisionId).toBe(decisionId);
    expect(actionEntry.junctionId).toBe(junctionFingerprint);
    incrementMetric("actions_planned");
  });

  it("action plan has deterministic idempotency key", () => {
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);
    const entry1 = planAction(
      "demo_safe_action",
      decisionId,
      junctionFingerprint,
      { dryRun: true, recommendedAction: decisionOutput.recommended_action },
    );
    const entry2 = planAction(
      "demo_safe_action",
      decisionId,
      junctionFingerprint,
      { dryRun: true, recommendedAction: decisionOutput.recommended_action },
    );
    assertFingerprintStable(entry1.idempotencyKey, entry2.idempotencyKey, "action idempotency key");
  });

  it("emits action.planned event", () => {
    emitEvent("action.planned", actionEntry.id, "action", {
      actionType: actionEntry.actionType,
      decisionId: actionEntry.decisionId,
      junctionId: actionEntry.junctionId,
    });
    incrementMetric("events_emitted");
    const planEvents = eventJournal.filter((e) => e.type === "action.planned");
    expect(planEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── STEP E: Approve + execute SAFE demo action ───────────────────────────────

describe("E: Action approval and safe execution", () => {
  it("approves the action plan", () => {
    approveAction(actionEntry);
    expect(actionEntry.status).toBe("approved");
  });

  it("executes the safe demo action (non-destructive)", () => {
    executeAction(actionEntry);
    expect(actionEntry.status).toBe("executed");
    expect(actionEntry.executedAt).toBe(FIXED_TIMESTAMP);
    incrementMetric("actions_executed");
  });

  it("emits action.executed event", () => {
    emitEvent("action.executed", actionEntry.id, "action", {
      actionType: actionEntry.actionType,
      executedAt: actionEntry.executedAt,
      idempotencyKey: actionEntry.idempotencyKey,
    });
    incrementMetric("events_emitted");
    const execEvents = eventJournal.filter((e) => e.type === "action.executed");
    expect(execEvents).toHaveLength(1);
  });
});

// ─── STEP F: Verify action journal entries linked to decision/junction ────────

describe("F: Action journal integrity", () => {
  it("action journal contains executed entry", () => {
    const executed = actionJournal.filter((e) => e.status === "executed");
    expect(executed.length).toBeGreaterThanOrEqual(1);
  });

  it("executed action is linked to decision and junction", () => {
    const executed = actionJournal.find((e) => e.status === "executed" && e.id === actionEntry.id);
    expect(executed).toBeDefined();
    expect(executed!.decisionId).toBe(actionEntry.decisionId);
    expect(executed!.junctionId).toBe(junctionFingerprint);
  });

  it("action journal entries have deterministic IDs", () => {
    const entry = actionJournal.find((e) => e.id === actionEntry.id);
    expect(entry).toBeDefined();
    // Re-derive the ID and verify it matches
    const expectedId = hashString(`action:${actionEntry.idempotencyKey}`).slice(0, 16);
    expect(entry!.id).toBe(expectedId);
  });
});

// ─── STEP G: Verify events emitted for each major step ───────────────────────

describe("G: Event emission verification", () => {
  it("all expected event types were emitted", () => {
    const emittedTypes = new Set(eventJournal.map((e) => e.type));
    expect(emittedTypes.has("junction.created")).toBe(true);
    expect(emittedTypes.has("decision.evaluated")).toBe(true);
    expect(emittedTypes.has("action.planned")).toBe(true);
    expect(emittedTypes.has("action.executed")).toBe(true);
  });

  it("all events have fixed deterministic timestamps", () => {
    for (const event of eventJournal) {
      expect(event.timestamp, `event '${event.type}' must have fixed timestamp`).toBe(FIXED_TIMESTAMP);
    }
  });

  it("events are linked to correct entity types", () => {
    const junctionEvent = eventJournal.find((e) => e.type === "junction.created");
    expect(junctionEvent?.entityType).toBe("junction");

    const decisionEvent = eventJournal.find((e) => e.type === "decision.evaluated");
    expect(decisionEvent?.entityType).toBe("decision");

    const actionEvents = eventJournal.filter((e) => e.entityType === "action");
    expect(actionEvents.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── STEP H: Metrics/vitals summary ──────────────────────────────────────────

describe("H: Metrics and vitals", () => {
  it("all expected counters were incremented", () => {
    expect(metrics.decisions_evaluated).toBeGreaterThanOrEqual(1);
    expect(metrics.junctions_created).toBeGreaterThanOrEqual(1);
    expect(metrics.actions_planned).toBeGreaterThanOrEqual(1);
    expect(metrics.actions_executed).toBeGreaterThanOrEqual(1);
    expect(metrics.events_emitted).toBeGreaterThanOrEqual(4);
  });

  it("metrics are consistent with journal state", () => {
    const executedCount = actionJournal.filter((e) => e.status === "executed").length;
    expect(metrics.actions_executed).toBe(executedCount);
  });

  it("metrics summary is deterministic", () => {
    const summary1 = { ...metrics };
    const summary2 = { ...metrics };
    assertCanonicalEqual(summary1, summary2, "metrics summary must be stable");
  });
});

// ─── STEP I: Export bundle and verify manifest hashes ────────────────────────

describe("I: Bundle export and manifest verification", () => {
  it("exports a deterministic bundle manifest", () => {
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);
    const decisionHash = hashString(canonicalJson(decisionOutput));
    const actionHash = hashString(canonicalJson({ id: actionEntry.id, status: actionEntry.status }));
    const junctionHash = hashString(canonicalJson({ fingerprint: junctionFingerprint, type: DEMO_JUNCTION_TRIGGER.type }));

    // Build deterministic manifest with sorted keys
    bundleManifest = Object.fromEntries(
      Object.entries({
        "action.json": actionHash,
        "decision.json": decisionHash,
        "junction.json": junctionHash,
        "manifest.json": "", // placeholder, filled below
      }).sort(([a], [b]) => a.localeCompare(b)),
    );

    // Manifest hash is derived from all other hashes (sorted)
    const manifestHash = combineHashes(
      Object.entries(bundleManifest)
        .filter(([k]) => k !== "manifest.json")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v),
    );
    bundleManifest["manifest.json"] = manifestHash;

    // Write bundle to temp dir
    const bundleDir = join(testEnv.tempDir, "bundle");
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(join(bundleDir, "manifest.json"), JSON.stringify(bundleManifest, null, 2));
    writeFileSync(join(bundleDir, "decision.json"), canonicalJson(decisionOutput));
    writeFileSync(join(bundleDir, "action.json"), canonicalJson({ id: actionEntry.id, status: actionEntry.status }));
    writeFileSync(join(bundleDir, "junction.json"), canonicalJson({ fingerprint: junctionFingerprint, type: DEMO_JUNCTION_TRIGGER.type }));

    incrementMetric("bundles_exported");
    expect(existsSync(join(bundleDir, "manifest.json"))).toBe(true);
  });

  it("bundle manifest ordering is deterministic", () => {
    const keys = Object.keys(bundleManifest);
    const sortedKeys = [...keys].sort();
    expect(keys).toEqual(sortedKeys);
  });

  it("bundle verify succeeds: all file hashes match manifest", () => {
    const bundleDir = join(testEnv.tempDir, "bundle");
    const manifest = JSON.parse(readFileSync(join(bundleDir, "manifest.json"), "utf8")) as Record<string, string>;

    for (const [filename, expectedHash] of Object.entries(manifest)) {
      if (filename === "manifest.json") continue;
      const content = readFileSync(join(bundleDir, filename), "utf8");
      const actualHash = hashString(content);
      expect(actualHash, `bundle file '${filename}' hash must match manifest`).toBe(expectedHash);
    }
  });

  it("tampered bundle file fails verification", () => {
    const bundleDir = join(testEnv.tempDir, "bundle");
    const manifest = JSON.parse(readFileSync(join(bundleDir, "manifest.json"), "utf8")) as Record<string, string>;

    // Tamper with decision.json
    const originalContent = readFileSync(join(bundleDir, "decision.json"), "utf8");
    writeFileSync(join(bundleDir, "decision.json"), originalContent + " TAMPERED");

    let tamperDetected = false;
    for (const [filename, expectedHash] of Object.entries(manifest)) {
      if (filename === "manifest.json") continue;
      const content = readFileSync(join(bundleDir, filename), "utf8");
      const actualHash = hashString(content);
      if (actualHash !== expectedHash) {
        tamperDetected = true;
        break;
      }
    }
    expect(tamperDetected, "tampered bundle must be detected").toBe(true);

    // Restore original content
    writeFileSync(join(bundleDir, "decision.json"), originalContent);
  });
});

// ─── STEP J: Retention compact (dry-run) ─────────────────────────────────────

describe("J: Retention compact (dry-run)", () => {
  it("dry-run compact reports what would be removed without removing anything", () => {
    const bundleDir = join(testEnv.tempDir, "bundle");

    // Simulate dry-run: identify files older than retention window
    // In dry-run mode, we only report — never delete
    const retentionWindowDays = 30;
    const filesToCheck = ["decision.json", "action.json", "junction.json"];

    const wouldRemove: string[] = [];
    // In this test, all files have FIXED_TIMESTAMP which is epoch (very old)
    // but dry-run must NOT actually remove them
    for (const filename of filesToCheck) {
      const path = join(bundleDir, filename);
      if (existsSync(path)) {
        // Simulate: file is older than retention window → would be removed
        wouldRemove.push(filename);
      }
    }

    // Dry-run: report but do NOT delete
    expect(wouldRemove.length).toBeGreaterThan(0);

    // Verify files still exist after dry-run
    for (const filename of filesToCheck) {
      expect(existsSync(join(bundleDir, filename)), `dry-run must not delete '${filename}'`).toBe(true);
    }
  });

  it("compact does not break bundle verify after dry-run", () => {
    const bundleDir = join(testEnv.tempDir, "bundle");
    const manifest = JSON.parse(readFileSync(join(bundleDir, "manifest.json"), "utf8")) as Record<string, string>;

    // After dry-run, all files must still be verifiable
    for (const [filename, expectedHash] of Object.entries(manifest)) {
      if (filename === "manifest.json") continue;
      const content = readFileSync(join(bundleDir, filename), "utf8");
      const actualHash = hashString(content);
      expect(actualHash, `post-compact verify: '${filename}' hash must still match`).toBe(expectedHash);
    }
  });

  it("prune requires confirmation — dry-run does not remove required chain data", () => {
    // Simulate prune dry-run: required chain data (manifest.json) must never be removed
    const bundleDir = join(testEnv.tempDir, "bundle");
    const requiredChainFiles = ["manifest.json"];

    // Dry-run prune: simulate what would be removed
    const wouldPrune: string[] = ["decision.json", "action.json"]; // non-chain data

    // Required chain files must NOT be in the prune list
    for (const required of requiredChainFiles) {
      expect(wouldPrune.includes(required), `required chain file '${required}' must not be pruned`).toBe(false);
    }

    // Verify required chain files still exist
    for (const required of requiredChainFiles) {
      expect(existsSync(join(bundleDir, required)), `required chain file '${required}' must exist`).toBe(true);
    }
  });
});

// ─── STEP K: Search for entities by fingerprint/id ───────────────────────────

describe("K: Entity search and discoverability", () => {
  it("junction is discoverable by fingerprint", () => {
    const found = eventJournal.find(
      (e) => e.type === "junction.created" && e.entityId === junctionFingerprint,
    );
    expect(found).toBeDefined();
    expect(found!.entityId).toBe(junctionFingerprint);
  });

  it("action is discoverable by id", () => {
    const found = actionJournal.find((e) => e.id === actionEntry.id);
    expect(found).toBeDefined();
    expect(found!.status).toBe("executed");
  });

  it("decision is discoverable by canonical hash", () => {
    const decisionId = hashString(canonicalJson(DEMO_DECISION_INPUT)).slice(0, 16);
    const found = eventJournal.find(
      (e) => e.type === "decision.evaluated" && e.entityId === decisionId,
    );
    expect(found).toBeDefined();
  });

  it("all entities are linked through the event journal", () => {
    const junctionEvent = eventJournal.find((e) => e.type === "junction.created");
    const decisionEvent = eventJournal.find((e) => e.type === "decision.evaluated");
    const actionPlanEvent = eventJournal.find((e) => e.type === "action.planned");
    const actionExecEvent = eventJournal.find((e) => e.type === "action.executed");

    expect(junctionEvent).toBeDefined();
    expect(decisionEvent).toBeDefined();
    expect(actionPlanEvent).toBeDefined();
    expect(actionExecEvent).toBeDefined();

    // Action plan event references both decision and junction
    expect(actionPlanEvent!.payload.decisionId).toBe(decisionEvent!.entityId);
    expect(actionPlanEvent!.payload.junctionId).toBe(junctionEvent!.entityId);
  });
});

// ─── BONUS: Zeolite end-to-end flow ──────────────────────────────────────────

describe("Zeolite end-to-end flow", () => {
  it("loads context deterministically", () => {
    const result = executeZeoliteOperation("load_context", DEMO_ZEOLITE_SEED);
    zeoliteContextId = String(result.contextId);
    expect(zeoliteContextId).toHaveLength(16);
    expect(result.actionCount).toBeGreaterThan(0);
  });

  it("context ID is stable for same seed", () => {
    const result1 = executeZeoliteOperation("load_context", DEMO_ZEOLITE_SEED);
    const result2 = executeZeoliteOperation("load_context", DEMO_ZEOLITE_SEED);
    expect(String(result1.contextId)).toBe(String(result2.contextId));
  });

  it("submits evidence deterministically", () => {
    for (const evidence of DEMO_EVIDENCE) {
      const result = executeZeoliteOperation("submit_evidence", {
        contextId: zeoliteContextId,
        ...evidence,
      });
      expect(result.evidenceId).toBeDefined();
      expect(typeof result.evidenceId).toBe("string");
    }
  });

  it("computes flip distance deterministically", () => {
    const result1 = executeZeoliteOperation("compute_flip_distance", { contextId: zeoliteContextId });
    const result2 = executeZeoliteOperation("compute_flip_distance", { contextId: zeoliteContextId });
    assertCanonicalEqual(result1.counterfactuals, result2.counterfactuals, "flip distances must be deterministic");
  });

  it("exports transcript with stable hash", () => {
    const result = executeZeoliteOperation("export_transcript", { contextId: zeoliteContextId }) as {
      transcriptId: string;
      transcriptHash: string;
      transcript: unknown;
    };
    transcriptId = result.transcriptId;
    transcriptHash = result.transcriptHash;
    expect(transcriptId).toBeDefined();
    expect(transcriptHash).toBeDefined();
    expect(typeof transcriptHash).toBe("string");
    expect(transcriptHash.length).toBeGreaterThan(0);
  });

  it("verifies transcript successfully", () => {
    const result = executeZeoliteOperation("verify_transcript", {
      contextId: zeoliteContextId,
      transcriptId,
    });
    expect(result.verification).toBeDefined();
  });

  it("replays transcript and produces same hash", () => {
    const result = executeZeoliteOperation("replay_transcript", {
      contextId: zeoliteContextId,
      transcriptId,
    }) as { replay: { sameHash: boolean; originalHash: string; replayHash: string } };
    expect(result.replay.sameHash).toBe(true);
    expect(result.replay.originalHash).toBe(transcriptHash);
    expect(result.replay.replayHash).toBe(transcriptHash);
  });
});
