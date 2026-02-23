// @ts-nocheck
/**
 * Trust Engine CLI
 *
 * Commands:
 *   zeo replay <run_id>         Replay and verify deterministic agreement
 *   zeo diff <runA> <runB>      Compare two runs
 *   zeo explain <run_id>        Summarized reasoning trace
 *   zeo trace <run_id>          Step-by-step structured trace
 *   zeo snapshots               List all snapshots
 */

export interface TrustCliArgs {
  command: "replay-run" | "diff" | "explain" | "trace" | "snapshots" | null;
  runId: string | undefined;
  runIdB: string | undefined;
  json: boolean;
}

export function parseTrustArgs(argv: string[]): TrustCliArgs {
  return {
    command: null,
    runId: argv[0],
    runIdB: argv[1],
    json: argv.includes("--json"),
  };
}

export async function runTrustReplayCommand(runId: string, json: boolean): Promise<number> {
  const { replayRun, formatReplayResult } = await import("@zeo/core");

  try {
    const result = replayRun(runId);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatReplayResult(result));
    }
    return result.verdict === "PASS" ? 0 : 1;
  } catch (err) {
    console.error(`[REPLAY_ERROR] ${(err as Error).message}`);
    return 1;
  }
}

export async function runDiffCommand(
  runIdA: string,
  runIdB: string,
  json: boolean,
): Promise<number> {
  const { diffRuns, formatRunDiff } = await import("@zeo/core");

  try {
    const diff = diffRuns(runIdA, runIdB);
    if (json) {
      console.log(JSON.stringify(diff, null, 2));
    } else {
      console.log(formatRunDiff(diff));
    }
    return 0;
  } catch (err) {
    console.error(`[DIFF_ERROR] ${(err as Error).message}`);
    return 1;
  }
}

export async function runExplainCommand(runId: string, json: boolean): Promise<number> {
  const { loadSnapshot } = await import("@zeo/core");

  const snapshot = loadSnapshot(runId);
  if (!snapshot) {
    console.error(`Snapshot not found: ${runId}`);
    console.error("Run 'zeo snapshots' to list available snapshots.");
    return 1;
  }

  if (json) {
    console.log(
      JSON.stringify(
        {
          runId: snapshot.runId,
          createdAt: snapshot.createdAt,
          deterministic: snapshot.deterministic,
          seed: snapshot.seed,
          inputHash: snapshot.inputHash,
          outputHash: snapshot.outputHash,
          chainHash: snapshot.chainHash,
          durationMs: snapshot.durationMs,
          spec: {
            title: snapshot.input.spec.title,
            context: snapshot.input.spec.context,
            actions: snapshot.input.spec.actions.length,
            assumptions: snapshot.input.spec.assumptions.length,
          },
          evaluations: snapshot.output?.evaluations.map((e) => ({
            lens: e.lens,
            robustActions: e.robustActions.length,
            fragileAssumptions: e.fragileAssumptions.length,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`\n=== Run Explanation: ${snapshot.runId} ===`);
    console.log(`Created: ${snapshot.createdAt}`);
    console.log(`Deterministic: ${snapshot.deterministic}`);
    if (snapshot.seed) console.log(`Seed: ${snapshot.seed}`);
    console.log(`Duration: ${snapshot.durationMs}ms`);
    console.log(`Input Hash: ${snapshot.inputHash.slice(0, 16)}...`);
    console.log(`Output Hash: ${snapshot.outputHash.slice(0, 16)}...`);
    console.log(`Chain Hash: ${snapshot.chainHash.slice(0, 16)}...`);
    console.log("");
    console.log(`Decision: ${snapshot.input.spec.title}`);
    console.log(`Context: ${snapshot.input.spec.context}`);
    console.log(`Actions: ${snapshot.input.spec.actions.length}`);
    console.log(`Assumptions: ${snapshot.input.spec.assumptions.length}`);

    if (snapshot.output) {
      console.log("");
      console.log("Evaluations:");
      for (const evaluation of snapshot.output.evaluations) {
        console.log(
          `  [${evaluation.lens}] Robust: ${evaluation.robustActions.length}, Fragile: ${evaluation.fragileAssumptions.length}`,
        );
      }

      if (snapshot.output.explanation) {
        console.log("");
        console.log("Reasoning:");
        for (const why of snapshot.output.explanation.why) {
          console.log(`  - ${why}`);
        }
        if (snapshot.output.explanation.whatWouldChange.length > 0) {
          console.log("");
          console.log("What Would Change:");
          for (const change of snapshot.output.explanation.whatWouldChange) {
            console.log(`  - ${change.assumptionId}: ${change.flipCondition}`);
          }
        }
      }
    }
  }

  return 0;
}

export async function runTraceCommand(runId: string, json: boolean): Promise<number> {
  const { loadSnapshot } = await import("@zeo/core");

  const snapshot = loadSnapshot(runId);
  if (!snapshot) {
    console.error(`Snapshot not found: ${runId}`);
    return 1;
  }

  // Build trace from snapshot data
  const trace = {
    runId: snapshot.runId,
    steps: [] as Array<{
      step: number;
      phase: string;
      detail: string;
      outputHash: string;
    }>,
  };

  let stepNum = 0;

  // Step 1: Input canonicalization
  trace.steps.push({
    step: ++stepNum,
    phase: "input_canonicalization",
    detail: `Canonicalized decision spec: "${snapshot.input.spec.title}"`,
    outputHash: snapshot.inputHash.slice(0, 16),
  });

  // Step 2: Branch generation
  if (snapshot.output) {
    trace.steps.push({
      step: ++stepNum,
      phase: "branch_generation",
      detail: `Generated ${snapshot.output.graph.nodes.length} nodes, ${snapshot.output.graph.edges.length} edges`,
      outputHash: snapshot.outputHash.slice(0, 16),
    });

    // Step 3: Evaluations
    for (const evaluation of snapshot.output.evaluations) {
      trace.steps.push({
        step: ++stepNum,
        phase: `evaluation_${evaluation.lens}`,
        detail: `${evaluation.lens}: ${evaluation.robustActions.length} robust, ${evaluation.dominatedActions.length} dominated`,
        outputHash: snapshot.outputHash.slice(0, 16),
      });
    }

    // Step 4: Flip conditions
    if (snapshot.output.explanation.whatWouldChange.length > 0) {
      trace.steps.push({
        step: ++stepNum,
        phase: "flip_conditions",
        detail: `${snapshot.output.explanation.whatWouldChange.length} flip condition(s) identified`,
        outputHash: snapshot.outputHash.slice(0, 16),
      });
    }

    // Step 5: Evidence ranking
    trace.steps.push({
      step: ++stepNum,
      phase: "evidence_ranking",
      detail: `${snapshot.output.nextBestEvidence.length} evidence action(s) ranked`,
      outputHash: snapshot.outputHash.slice(0, 16),
    });

    // Step 6: Snapshot finalization
    trace.steps.push({
      step: ++stepNum,
      phase: "snapshot_finalization",
      detail: `Chain hash: ${snapshot.chainHash.slice(0, 16)}`,
      outputHash: snapshot.chainHash.slice(0, 16),
    });
  }

  if (json) {
    console.log(JSON.stringify(trace, null, 2));
  } else {
    console.log(`\n=== Execution Trace: ${snapshot.runId} ===\n`);
    for (const step of trace.steps) {
      console.log(`[Step ${step.step}] ${step.phase}`);
      console.log(`  ${step.detail}`);
      console.log(`  Hash: ${step.outputHash}...`);
      console.log("");
    }
  }

  return 0;
}

export async function runSnapshotsCommand(json: boolean): Promise<number> {
  const { listSnapshots, loadSnapshot } = await import("@zeo/core");

  const ids = listSnapshots();
  if (ids.length === 0) {
    console.log("No snapshots found. Run a decision with --deterministic to create snapshots.");
    return 0;
  }

  if (json) {
    const snapshots = ids
      .map((id) => {
        const s = loadSnapshot(id);
        return s
          ? {
              runId: s.runId,
              createdAt: s.createdAt,
              deterministic: s.deterministic,
              inputHash: s.inputHash,
              outputHash: s.outputHash,
            }
          : null;
      })
      .filter(Boolean);
    console.log(JSON.stringify(snapshots, null, 2));
  } else {
    console.log(`\nSnapshots (${ids.length}):\n`);
    for (const id of ids) {
      const s = loadSnapshot(id);
      if (s) {
        console.log(
          `  ${s.runId} | ${s.createdAt} | ${s.deterministic ? "deterministic" : "non-deterministic"} | ${s.durationMs}ms`,
        );
      }
    }
  }

  return 0;
}
