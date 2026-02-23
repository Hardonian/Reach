// @ts-nocheck
/**
 * Evidence Graph CLI
 *
 * Commands:
 *   zeo evidence list [--stale] [--tag <tag>] [--decision <id>] [--high-regret]
 *   zeo evidence add --claim <text> --source <text> [--confidence <0-1>] [--decay <rate>]
 *   zeo evidence mark <id> --outcome positive|negative
 *   zeo evidence drift [--threshold <0-1>]
 *   zeo refresh-evidence
 *   zeo evidence regret
 */

export interface EvidenceGraphCliArgs {
  command: "list" | "add" | "mark" | "drift" | "refresh" | "regret" | null;
  stale: boolean;
  tag: string | undefined;
  decision: string | undefined;
  highRegret: boolean;
  claim: string | undefined;
  source: string | undefined;
  confidence: number;
  decay: number;
  evidenceId: string | undefined;
  outcome: "positive" | "negative" | undefined;
  threshold: number;
  json: boolean;
}

export function parseEvidenceGraphArgs(argv: string[]): EvidenceGraphCliArgs {
  const result: EvidenceGraphCliArgs = {
    command: null,
    stale: false,
    tag: undefined,
    decision: undefined,
    highRegret: false,
    claim: undefined,
    source: undefined,
    confidence: 0.7,
    decay: 0.01,
    evidenceId: undefined,
    outcome: undefined,
    threshold: 0.3,
    json: false,
  };

  const cmd = argv[0];
  if (
    cmd === "list" ||
    cmd === "add" ||
    cmd === "mark" ||
    cmd === "drift" ||
    cmd === "refresh" ||
    cmd === "regret"
  ) {
    result.command = cmd;
  }

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--stale") result.stale = true;
    else if (arg === "--high-regret") result.highRegret = true;
    else if (arg === "--json") result.json = true;
    else if (arg === "--tag" && next) {
      result.tag = next;
      i++;
    } else if (arg === "--decision" && next) {
      result.decision = next;
      i++;
    } else if (arg === "--claim" && next) {
      result.claim = next;
      i++;
    } else if (arg === "--source" && next) {
      result.source = next;
      i++;
    } else if (arg === "--confidence" && next) {
      result.confidence = parseFloat(next);
      i++;
    } else if (arg === "--decay" && next) {
      result.decay = parseFloat(next);
      i++;
    } else if (arg === "--outcome" && next) {
      if (next === "positive" || next === "negative") result.outcome = next;
      i++;
    } else if (arg === "--threshold" && next) {
      result.threshold = parseFloat(next);
      i++;
    } else if (!result.evidenceId && result.command === "mark") {
      result.evidenceId = arg;
    }
  }

  return result;
}

export async function runEvidenceGraphCommand(args: EvidenceGraphCliArgs): Promise<number> {
  const core = await import("@zeo/core");

  if (!args.command) {
    printEvidenceHelp();
    return 1;
  }

  const graph = core.loadEvidenceGraph();

  switch (args.command) {
    case "list": {
      let nodes = graph.nodes;

      if (args.stale) nodes = core.filterStale(graph, args.threshold);
      else if (args.tag) nodes = core.filterByTag(graph, args.tag);
      else if (args.decision) nodes = core.filterByDecision(graph, args.decision);
      else if (args.highRegret) nodes = core.filterHighRegret(graph);

      if (args.json) {
        console.log(JSON.stringify(nodes, null, 2));
      } else {
        console.log(core.formatEvidenceList(nodes));
      }
      return 0;
    }

    case "add": {
      if (!args.claim || !args.source) {
        console.error(
          "Usage: zeo evidence add --claim <text> --source <text> [--confidence <0-1>] [--decay <rate>]",
        );
        return 1;
      }

      const node = core.registerClaim(graph, {
        claim: args.claim,
        source: args.source,
        confidenceScore: args.confidence,
        decayRate: args.decay,
      });

      core.saveEvidenceGraph(graph);

      if (args.json) {
        console.log(JSON.stringify(node, null, 2));
      } else {
        console.log(`Registered: ${node.id}`);
        console.log(`  Claim: ${node.claim}`);
        console.log(`  Confidence: ${(node.confidenceScore * 100).toFixed(1)}%`);
      }
      return 0;
    }

    case "mark": {
      if (!args.evidenceId || !args.outcome) {
        console.error("Usage: zeo evidence mark <evidence_id> --outcome positive|negative");
        return 1;
      }

      try {
        const outcomeMarker =
          args.outcome === "positive"
            ? ("outcome_positive" as const)
            : ("outcome_negative" as const);
        core.markOutcome(graph, args.evidenceId, outcomeMarker);
        core.saveEvidenceGraph(graph);
        console.log(`Marked ${args.evidenceId} as ${args.outcome}`);
      } catch (err) {
        console.error(`[EVIDENCE_ERROR] ${(err as Error).message}`);
        return 1;
      }
      return 0;
    }

    case "drift": {
      const alerts = core.detectDrift(graph, args.threshold);
      if (args.json) {
        console.log(JSON.stringify(alerts, null, 2));
      } else {
        console.log(core.formatDriftAlerts(alerts));
      }
      return alerts.length > 0 ? 1 : 0;
    }

    case "refresh": {
      const updated = core.refreshConfidence(graph);
      core.saveEvidenceGraph(graph);
      console.log(`Refreshed ${updated} evidence node(s)`);

      // Also check for drift
      const alerts = core.detectDrift(graph, args.threshold);
      if (alerts.length > 0) {
        console.log("");
        console.log(core.formatDriftAlerts(alerts));
      }
      return 0;
    }

    case "regret": {
      const highRegret = core.filterHighRegret(graph);
      if (args.json) {
        console.log(JSON.stringify(highRegret, null, 2));
      } else {
        if (highRegret.length === 0) {
          console.log("No high-regret evidence nodes.");
        } else {
          console.log(`High-Regret Evidence (${highRegret.length}):\n`);
          console.log(core.formatEvidenceList(highRegret));
        }
      }
      return 0;
    }

    default:
      printEvidenceHelp();
      return 1;
  }
}

function printEvidenceHelp(): void {
  console.log(`
Zeo Evidence Graph Commands

Usage:
  zeo evidence list [--stale] [--tag <tag>] [--decision <id>] [--high-regret]
  zeo evidence add --claim <text> --source <text> [--confidence <0-1>] [--decay <rate>]
  zeo evidence mark <id> --outcome positive|negative
  zeo evidence drift [--threshold <0-1>]
  zeo evidence regret
  zeo refresh-evidence
`);
}
