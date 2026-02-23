// @ts-nocheck
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface SnapshotStatePointer {
  snapshotId: string;
  restoredAt: string;
}

function stateDir(): string {
  return join(homedir(), ".zeo", "state");
}

function statePointerPath(): string {
  return join(stateDir(), "current-snapshot.json");
}

function parseFromStep(argv: string[]): number {
  const idx = argv.indexOf("--from-step");
  if (idx === -1 || !argv[idx + 1]) return 1;
  const parsed = Number.parseInt(argv[idx + 1], 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

export async function runSnapshotCreateCommand(debug = false): Promise<number> {
  const core = await import("@zeo/core");
  const spec = core.makeNegotiationExample();
  const seed = "snapshot-create";
  core.activateDeterministicMode({ seed });

  let result;
  try {
    result = core.runDecision(spec, { depth: 2 });
  } finally {
    core.deactivateDeterministicMode();
  }

  const snapshot = core.createSnapshot({
    spec,
    opts: { depth: 2, example: "negotiation" },
    result,
    toolRegistry: core.getDefaultToolRegistry(),
    durationMs: 0,
    deterministic: true,
    seed,
    idCounterOffset: 0,
  });
  const path = core.saveSnapshot(snapshot);

  if (debug) {
    console.log(
      `[debug] step=1 phase=input_canonicalization hash=${snapshot.inputHash.slice(0, 12)}`,
    );
    console.log(
      `[debug] step=2 phase=branch_generation output=${snapshot.outputHash.slice(0, 12)}`,
    );
    console.log(
      `[debug] step=3 phase=snapshot_finalization pipeline=${snapshot.pipelineHash.slice(0, 12)}`,
    );
  }

  console.log(`Created snapshot ${snapshot.snapshotId} (${path})`);
  return 0;
}

export async function runSnapshotListCommand(json = false): Promise<number> {
  const core = await import("@zeo/core");
  const ids = core.listSnapshots();
  if (json) {
    const snapshots = ids
      .map((id: string) => core.loadSnapshot(id))
      .filter(Boolean);
    console.log(JSON.stringify(snapshots, null, 2));
    return 0;
  }

  if (ids.length === 0) {
    console.log("No snapshots found.");
    return 0;
  }

  for (const id of ids) {
    const snapshot = core.loadSnapshot(id);
    if (snapshot) {
      console.log(
        `${snapshot.snapshotId} | run=${snapshot.runId} | pointer=${snapshot.executionPointer.step}/${snapshot.executionPointer.totalSteps}`,
      );
    }
  }
  return 0;
}

export async function runSnapshotRestoreCommand(
  snapshotId: string,
): Promise<number> {
  const core = await import("@zeo/core");
  const snapshot = core.loadSnapshot(snapshotId);
  if (!snapshot) {
    console.error(`Snapshot not found: ${snapshotId}`);
    return 1;
  }

  const validation = core.validateSnapshotEnvironment(snapshot);
  if (validation.ok === false) {
    console.error(
      `Cannot restore snapshot due to environment mismatch: ${validation.reason}`,
    );
    return 1;
  }

  if (!existsSync(stateDir())) {
    mkdirSync(stateDir(), { recursive: true });
  }

  const pointer: SnapshotStatePointer = {
    snapshotId: snapshot.snapshotId,
    restoredAt: new Date().toISOString(),
  };
  writeFileSync(
    statePointerPath(),
    `${JSON.stringify(pointer, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Restored snapshot ${snapshot.snapshotId} at execution pointer ${snapshot.executionPointer.step}.`,
  );
  return 0;
}

export async function runReplayFromStepCommand(
  runId: string,
  argv: string[],
): Promise<number> {
  const { replayRun, formatReplayResult } = await import("@zeo/core");
  const fromStep = parseFromStep(argv);
  const result = replayRun(runId, undefined, fromStep);
  console.log(formatReplayResult(result));
  return result.verdict === "PASS" ? 0 : 1;
}

export function getRestoredSnapshotPointer(): SnapshotStatePointer | null {
  const path = statePointerPath();
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as SnapshotStatePointer;
}
