// @ts-nocheck
/**
 * Planning Engine CLI
 *
 * Commands:
 *   zeo plan --budget <x>       Generate bounded evidence plan
 *   zeo plan --flip             Show flip distance analysis
 *   zeo plan --voi              Show value of information rankings
 *   zeo plan --deltas           Show confidence delta projections
 */

export interface PlanCliArgs {
  budget: number;
  showFlip: boolean;
  showVoi: boolean;
  showDeltas: boolean;
  example: "negotiation" | "ops";
  depth: number;
  json: boolean;
}

export function parsePlanArgs(argv: string[]): PlanCliArgs {
  const result: PlanCliArgs = {
    budget: 50,
    showFlip: false,
    showVoi: false,
    showDeltas: false,
    example: "negotiation",
    depth: 2,
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--budget" && next) { result.budget = parseInt(next, 10); i++; }
    else if (arg === "--flip") result.showFlip = true;
    else if (arg === "--voi") result.showVoi = true;
    else if (arg === "--deltas") result.showDeltas = true;
    else if (arg === "--json") result.json = true;
    else if (arg === "--example" && next) {
      if (next === "negotiation" || next === "ops") result.example = next;
      i++;
    }
    else if (arg === "--depth" && next) { result.depth = parseInt(next, 10); i++; }
  }

  return result;
}

export async function runPlanCommand(args: PlanCliArgs): Promise<number> {
  const core = await import("@zeo/core");

  const spec = args.example === "ops" ? core.makeOpsExample() : core.makeNegotiationExample();
  const result = core.runDecision(spec, { depth: args.depth === 3 ? 3 : 2 });

  const showAll = !args.showFlip && !args.showVoi && !args.showDeltas;

  const output: Record<string, unknown> = {};

  // Flip distances
  if (args.showFlip || showAll) {
    const flips = core.computeFlipDistances(spec, result);
    if (args.json) {
      output.flipDistances = flips;
    } else {
      console.log(core.formatFlipDistances(flips));
    }
  }

  // VOI
  if (args.showVoi || showAll) {
    const voi = core.estimateVoi(spec, result);
    if (args.json) {
      output.voi = voi;
    } else {
      console.log("Value of Information Rankings:\n");
      for (const v of voi) {
        console.log(`  [VOI=${v.voiScore.toFixed(2)}] ${v.evidencePrompt}`);
        console.log(`    Benefit: ${(v.benefitScore * 100).toFixed(1)}% | Cost: ${(v.costScore * 100).toFixed(1)}%`);
        console.log("");
      }
    }
  }

  // Evidence plan
  if (showAll) {
    const plan = core.generateEvidencePlan(spec, result, args.budget);
    if (args.json) {
      output.plan = plan;
    } else {
      console.log(core.formatEvidencePlan(plan));
    }
  }

  // Confidence deltas
  if (args.showDeltas || showAll) {
    const deltas = core.projectConfidenceDeltas(spec, result);
    if (args.json) {
      output.confidenceDeltas = deltas;
    } else {
      console.log(core.formatConfidenceDeltas(deltas));
    }
  }

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  }

  return 0;
}

