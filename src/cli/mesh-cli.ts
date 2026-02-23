// @ts-nocheck
/**
 * Mesh CLI — zeo mesh commands + zeo sign-envelope + zeo verify-envelope
 *
 * Commands:
 *   zeo mesh status                         Show mesh status
 *   zeo mesh batch --mode=local|remote|off  Run batch through mesh
 *   zeo mesh start-worker --port=N          Start a worker server
 *   zeo sign-envelope <file>                Sign a job envelope file
 *   zeo verify-envelope <file>              Verify a job envelope file
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

export interface MeshCliArgs {
  command: string;
  subcommand?: string;
  file?: string;
  port?: number;
  mode?: string;
  count?: number;
  concurrency?: number;
  json?: boolean;
  out?: string;
}

export function parseMeshArgs(argv: string[]): MeshCliArgs {
  const args: MeshCliArgs = { command: argv[0] ?? "status" };

  if (argv[0] === "sign-envelope" || argv[0] === "verify-envelope") {
    args.command = argv[0];
    args.file = argv[1];
    args.json = argv.includes("--json");
    return args;
  }

  args.subcommand = argv[1];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port" && argv[i + 1]) args.port = Number(argv[i + 1]);
    if (argv[i]?.startsWith("--port=")) args.port = Number(argv[i].split("=")[1]);
    if (argv[i] === "--mode" && argv[i + 1]) args.mode = argv[i + 1];
    if (argv[i]?.startsWith("--mode=")) args.mode = argv[i].split("=")[1];
    if (argv[i] === "--count" && argv[i + 1]) args.count = Number(argv[i + 1]);
    if (argv[i]?.startsWith("--count=")) args.count = Number(argv[i].split("=")[1]);
    if (argv[i] === "--concurrency" && argv[i + 1]) args.concurrency = Number(argv[i + 1]);
    if (argv[i]?.startsWith("--concurrency=")) args.concurrency = Number(argv[i].split("=")[1]);
    if (argv[i] === "--json") args.json = true;
    if (argv[i] === "--out" && argv[i + 1]) args.out = argv[i + 1];
    if (argv[i]?.startsWith("--out=")) args.out = argv[i].split("=")[1];
    if (i >= 2 && !argv[i].startsWith("--")) args.file = args.file ?? argv[i];
  }

  return args;
}

export async function runMeshCommand(args: MeshCliArgs): Promise<number> {
  try {
    switch (args.command) {
      case "sign-envelope":
        return await cmdSignEnvelope(args);
      case "verify-envelope":
        return await cmdVerifyEnvelope(args);
      case "mesh":
        return await cmdMesh(args);
      default:
        console.error(`Unknown mesh command: ${args.command}`);
        return 1;
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

// ─── sign-envelope ───────────────────────────────────────────────────────

async function cmdSignEnvelope(args: MeshCliArgs): Promise<number> {
  if (!args.file) {
    console.error("Usage: zeo sign-envelope <file> [--out <path>]");
    return 1;
  }

  const filePath = resolve(args.file);
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return 1;
  }

  const { createJobEnvelope, computeCanonicalHash } = await import("@zeo/mesh");

  const raw = JSON.parse(readFileSync(filePath, "utf8"));

  // If it already has a signature, re-sign
  const unsigned = { ...raw, signature: "" };
  const body = {
    envelope_version: unsigned.envelope_version,
    job_id: unsigned.job_id,
    tenant_id: unsigned.tenant_id,
    policy_snapshot: unsigned.policy_snapshot,
    kernel_input: unsigned.kernel_input,
    schema_versions: unsigned.schema_versions,
    deterministic_config: unsigned.deterministic_config,
    trace_id: unsigned.trace_id,
    created_at: unsigned.created_at,
    nonce: unsigned.nonce,
  };

  const signature = computeCanonicalHash(body);
  const signed = { ...unsigned, signature };

  const outPath = args.out ? resolve(args.out) : filePath;
  writeFileSync(outPath, JSON.stringify(signed, null, 2) + "\n", "utf8");

  if (args.json) {
    console.log(JSON.stringify({ ok: true, signature, path: outPath }));
  } else {
    console.log(`✓ Envelope signed`);
    console.log(`  Signature: ${signature.slice(0, 16)}...`);
    console.log(`  Written to: ${outPath}`);
  }

  return 0;
}

// ─── verify-envelope ─────────────────────────────────────────────────────

async function cmdVerifyEnvelope(args: MeshCliArgs): Promise<number> {
  if (!args.file) {
    console.error("Usage: zeo verify-envelope <file>");
    return 1;
  }

  const filePath = resolve(args.file);
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return 1;
  }

  const { verifyJobEnvelope, verifyResultEnvelope } = await import("@zeo/mesh");

  const raw = JSON.parse(readFileSync(filePath, "utf8"));

  // Detect if it's a job envelope or result envelope
  if (raw.envelope_version) {
    const result = verifyJobEnvelope(raw);
    if (args.json) {
      console.log(JSON.stringify(result));
    } else if (result.valid) {
      console.log("✓ Job envelope signature VALID");
      console.log(`  Job ID:    ${raw.job_id}`);
      console.log(`  Tenant:    ${raw.tenant_id}`);
      console.log(`  Signature: ${raw.signature?.slice(0, 16)}...`);
    } else {
      console.error("✗ Job envelope signature INVALID");
      for (const err of result.errors) {
        console.error(`  Error: ${err}`);
      }
      return 1;
    }
  } else if (raw.result_version) {
    const result = verifyResultEnvelope(raw);
    if (args.json) {
      console.log(JSON.stringify(result));
    } else if (result.valid) {
      console.log("✓ Result envelope signature VALID");
      console.log(`  Job ID:      ${raw.job_id}`);
      console.log(`  Output Hash: ${raw.output_hash?.slice(0, 16)}...`);
    } else {
      console.error("✗ Result envelope signature INVALID");
      for (const err of result.errors) {
        console.error(`  Error: ${err}`);
      }
      return 1;
    }
  } else {
    console.error("Unknown envelope type. Expected envelope_version or result_version field.");
    return 1;
  }

  return 0;
}

// ─── mesh subcommands ────────────────────────────────────────────────────

async function cmdMesh(args: MeshCliArgs): Promise<number> {
  switch (args.subcommand) {
    case "status":
      return await cmdMeshStatus(args);
    case "batch":
      return await cmdMeshBatch(args);
    case "start-worker":
      return await cmdMeshStartWorker(args);
    default:
      printMeshHelp();
      return 0;
  }
}

async function cmdMeshStatus(args: MeshCliArgs): Promise<number> {
  const { MeshOrchestrator } = await import("@zeo/mesh");
  const mode = (args.mode ?? "off") as any;
  const orch = new MeshOrchestrator({ mode });
  const status = orch.getMeshStatus();

  if (args.json) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    console.log("=== Mesh Status ===");
    console.log(`Mode:            ${status.mode}`);
    console.log(`Total Workers:   ${status.totalWorkers}`);
    console.log(`Healthy Workers: ${status.healthyWorkers}`);
    console.log(`Completed Jobs:  ${status.completedJobs}`);
    if (status.workers.length > 0) {
      console.log("\nWorkers:");
      for (const w of status.workers) {
        const state = w.circuitOpen ? "CIRCUIT_OPEN" : w.healthy ? "healthy" : "unhealthy";
        console.log(`  ${w.id}: ${w.url} [${state}] jobs=${w.totalJobsHandled}`);
      }
    }
  }

  return 0;
}

async function cmdMeshBatch(args: MeshCliArgs): Promise<number> {
  const { MeshOrchestrator, ENVELOPE_VERSION } = await import("@zeo/mesh");
  const { KERNEL_SCHEMA_VERSION } = await import("@zeo/kernel");

  const mode = (args.mode ?? "local") as any;
  const count = args.count ?? 5;
  const concurrency = args.concurrency ?? 4;

  console.log(`Running ${count} jobs in ${mode} mode (concurrency: ${concurrency})...`);

  const orch = new MeshOrchestrator({
    mode,
    maxConcurrency: concurrency,
  });

  const jobs = Array.from({ length: count }, (_, i) => ({
    kernel_input: {
      spec: {
        id: `spec_batch_${i}`,
        title: `Batch Decision ${i}`,
        context: "Mesh batch test",
        horizon: "days" as const,
        agents: [{ id: "agent_1", label: "Agent", perspective: "Analytical" }],
        actions: [
          { id: "act_1", label: "Accept", actorId: "agent_1", kind: "accept" },
          { id: "act_2", label: "Reject", actorId: "agent_1", kind: "reject" },
        ],
        constraints: [
          {
            id: "c1",
            name: "Budget",
            value: "$5000",
            status: "fact" as const,
            provenance: ["system"],
          },
        ],
        assumptions: [
          {
            id: "a1",
            text: "Stable",
            status: "assumption" as const,
            confidence: "medium" as const,
          },
        ],
        objectives: [{ metric: "ROI", weight: 1 }],
      },
      evidenceSnapshot: { version: "1.0.0", nodes: [] as any[] },
      policySnapshot: {
        policies: [] as any[],
        enforcementStrength: "basic" as const,
      },
      toolResultsSnapshot: { tools: [] as any[] },
      config: {
        seed: `batch-${i}`,
        floatPrecision: 10,
        maxDepth: 2 as const,
        maxBranchesPerAction: 4,
        useQuantEngine: false,
      },
      schemaVersion: KERNEL_SCHEMA_VERSION,
    },
    tenant_id: "tenant_batch",
    policy_snapshot: {
      policies: [] as any[],
      enforcementStrength: "basic" as const,
    },
  }));

  const start = performance.now();
  const result = await orch.executeBatch(
    jobs,
    {
      seed: "batch-test",
      float_precision: 10,
      max_depth: 2,
    },
    {
      envelope: ENVELOPE_VERSION,
      kernel: KERNEL_SCHEMA_VERSION,
      ir: "1.0.0",
      policy: "1.0.0",
    },
  );
  const duration = performance.now() - start;

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          stats: result.stats,
          duration_ms: Math.round(duration),
          throughput: (count / (duration / 1000)).toFixed(1),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`\n=== Batch Results ===`);
    console.log(`Jobs:          ${result.stats.total_jobs}`);
    console.log(`Succeeded:     ${result.stats.succeeded}`);
    console.log(`Failed:        ${result.stats.failed}`);
    console.log(`Retried:       ${result.stats.retried}`);
    console.log(`Fallbacks:     ${result.stats.fallback_local}`);
    console.log(`Duration:      ${duration.toFixed(2)}ms`);
    console.log(`Throughput:    ${(count / (duration / 1000)).toFixed(1)} jobs/sec`);
    console.log(`Avg per job:   ${(duration / count).toFixed(2)}ms`);
    console.log(`Memory:        ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
  }

  return result.stats.failed > 0 ? 1 : 0;
}

async function cmdMeshStartWorker(args: MeshCliArgs): Promise<number> {
  const { startWorkerServer } = await import("@zeo/mesh");

  const port = args.port ?? 9876;
  console.log(`Starting mesh worker on port ${port}...`);

  const worker = await startWorkerServer({ port });
  console.log(`Worker ${worker.workerId} listening on port ${port}`);
  console.log(`  POST /execute — Submit job envelope`);
  console.log(`  GET  /health  — Health check`);
  console.log(`\nPress Ctrl+C to stop.`);

  // Keep running until interrupted
  await new Promise(() => {}); // blocks forever
  return 0;
}

function printMeshHelp(): void {
  console.log(`
Zeo Mesh — Federated Worker Mesh Commands

Usage:
  zeo mesh status                         Show mesh status
  zeo mesh batch [--mode=local] [--count=N] [--concurrency=N]
                                          Run batch through mesh
  zeo mesh start-worker [--port=N]        Start a worker server

  zeo sign-envelope <file> [--out <path>] Sign a job envelope
  zeo verify-envelope <file>              Verify a job/result envelope

Options:
  --mode=off|local|remote    Mesh execution mode (default: local)
  --count=N                  Number of jobs in batch (default: 5)
  --concurrency=N            Max concurrent jobs (default: 4)
  --port=N                   Worker server port (default: 9876)
  --json                     JSON output
  --out <path>               Output file path
`);
}
