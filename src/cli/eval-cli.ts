/**
 * Eval CLI Module
 *
 * Parses eval command arguments and runs evaluation suites.
 */

import { resolve } from "node:path";
import { runEvalSuite, runDeterminismCheck, type EvalCommand } from "@zeo/eval";

/**
 * Eval CLI arguments
 */
export interface EvalCliArgs {
  suite?: string;
  output?: string;
  determinism?: boolean;
  command?: string;
  verbose?: boolean;
}

/**
 * Parse eval arguments from command line
 */
export function parseEvalArgs(argv: string[]): EvalCliArgs {
  const result: EvalCliArgs = {
    suite: undefined,
    output: undefined,
    determinism: false,
    command: undefined,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if ((arg === "--suite" || arg === "-s") && next) {
      result.suite = next;
      i++;
    } else if ((arg === "--output" || arg === "-o") && next) {
      result.output = next;
      i++;
    } else if (arg === "--determinism" || arg === "-d") {
      result.determinism = true;
    } else if (arg === "--command" && next) {
      result.command = next;
      i++;
    } else if (arg === "--verbose" || arg === "-v") {
      result.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      printEvalHelp();
      process.exit(0);
    }
  }

  return result;
}

/**
 * Print eval command help
 */
export function printEvalHelp(): void {
  console.log(`
Zeo Eval - Epistemic Evaluation Harness v0.5.1

Usage: zeo eval [options]

Options:
  --suite, -s <path>     Path to evaluation suite JSON file
  --output, -o <dir>     Output directory for results
  --determinism, -d      Run determinism check (execute twice, compare)
  --command, -c <cmd>    Run a specific command from the suite
  --verbose, -v          Verbose output
  --help, -h             Show this help message

Examples:
  zeo eval --suite external/examples/eval/core-eval.json --output ./eval-results
  zeo eval --suite external/examples/eval/core-eval.json --determinism
  zeo eval --help

Eval Suite Format:
{
  "version": "0.5.1",
  "suiteId": "zeo-core-eval",
  "fixtures": [...],
  "commands": [...],
  "expectedOutputs": [...],
  "invariantChecks": [...]
}

For more info, see docs/EVAL.md
`);
}

/**
 * Run eval command
 */
export async function runEvalCommand(args: EvalCliArgs): Promise<number> {
  if (!args.suite) {
    console.error("[EVAL_ERROR] No evaluation suite specified. Use --suite <path>");
    console.error("Run 'zeo eval --help' for usage information.");
    return 1;
  }

  const suitePath = resolve(process.cwd(), args.suite);
  const outputDir = args.output || "./eval-results";

  try {
    if (args.determinism && args.command) {
      // Run determinism check for a single command
      const cmd: EvalCommand = JSON.parse(args.command);
      console.log(`\n=== Determinism Check ===`);
      console.log(`Suite: ${suitePath}`);
      console.log(`Running command: ${JSON.stringify(cmd)}`);

      const result = await runDeterminismCheck(cmd, process.cwd());

      console.log(`\nFirst run:  ${result.firstHash.slice(0, 16)}...`);
      console.log(`Second run: ${result.secondHash.slice(0, 16)}...`);
      console.log(`Identical:  ${result.identical ? "YES" : "NO"}`);

      return result.identical ? 0 : 1;
    }

    // Run full evaluation suite
    console.log(`\n=== Zeo Eval Suite ===`);
    console.log(`Suite: ${suitePath}`);
    console.log(`Output: ${outputDir}`);

    const result = await runEvalSuite(suitePath, outputDir);

    console.log(`\n--- Evaluation Results ---`);
    console.log(`Suite: ${result.suiteId}`);
    console.log(`Duration: ${result.totalDurationMs}ms`);
    console.log(`Overall: ${result.overallSuccess ? "PASSED" : "FAILED"}`);

    console.log(`\nInvariant Summary:`);
    console.log(`  Total: ${result.invariantSummary.total}`);
    console.log(`  Passed: ${result.invariantSummary.passed}`);
    console.log(`  Failed: ${result.invariantSummary.failed}`);
    console.log(`  Errors: ${result.invariantSummary.errors}`);

    console.log(`\nDeterminism Summary:`);
    console.log(`  Total: ${result.determinismSummary.total}`);
    console.log(`  Byte-identical: ${result.determinismSummary.byteIdentical}`);
    console.log(`  Diverged: ${result.determinismSummary.diverged}`);

    console.log(`\nResults written to: ${outputDir}/eval-results.json`);

    return result.overallSuccess ? 0 : 1;
  } catch (err) {
    console.error(`[EVAL_ERROR] ${err instanceof Error ? err.message : err}`);
    return 1;
  }
}
