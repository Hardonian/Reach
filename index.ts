import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import type { WorldModelSpec, EvidenceCandidate, PosteriorState, VoiReport } from "@zeo/contracts";
import { parseArgs, type CliArgs } from "./args.js";
import { createRunContext, log } from "./observability.js";


const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedVersion: string | null = null;
function getCliVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgPath = resolve(__dirname, "../package.json");
    cachedVersion = JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "1.0.0";
  } catch {
    cachedVersion = "1.0.0";
  }
  return cachedVersion;
}

function printHelp(): void {
  console.log(`
Zeo CLI - Epistemic Decision Engine v${getCliVersion()}

Deterministic decision intelligence with replayable evidence.
Start here: zeo analyze-pr <path|git-range|diff-file>
Replay: zeo replay <run_id|dataset|example>

Usage: zeo [options]

Commands:
  help <start|examples>      Guided quickstart and examples
  examples                   Alias for help examples
  start                      Start guided decision workspace
  template list              List built-in decision templates
  decision create            Create decision from deterministic template
  add-note                   Add plain-language note as evidence proposal
  run                        Run deterministic analysis and print result card
  next                       Show next evidence tasks checklist
  share                      Export compact share summary or channel output
  copy                       Print clipboard-friendly share block
  render <id>                Render deterministic output for github/slack/markdown/plain
  demo                       Run offline demo artifact generation
  export <md|ics|bundle>     Offline export commands
  export --deterministic     Reproducible local module tarball export
  export decision <id>       Portable decision bundle export
  verify <bundle|decision>   Verify exported bundle hashes/proofs
  decision-health <id>       Decision health snapshot
  drift-report               Drift events report
  roi-report                 Team ROI report by window
  evidence <cmd>             Evidence expiry commands
  quests                     Show evidence tasks as checkboxes
  done <taskId>              Mark checklist task as complete
  streaks                    Show epistemic streak metrics
  graph <show|impact|fragility> Decision graph utilities
  view <id>                  Persona-aware deterministic dashboard view
  review weekly              Weekly epistemic review
  explain                    Explain a decision for an audience
  summary                    Deterministic summary by decision type
  signals <file>              Process external signal payloads (JSON)
  --signals <file>            Process external signal payloads (JSON)
  --replay <file>             Run replay dataset for calibration testing
  --case <id>                 Run specific case from replay dataset
  --report-out <dir>          Write replay reports to directory
  --warehouse <cmd>           Warehouse management (export/import/list)
  --analytics <cmd>           Analytics pipeline (build-dataset/run)
  --regimes <cmd>             Regimes and policy control
  adapters <cmd>              Adapter runtime (run/ingest/quarantine)
  ingest                      Ingest from all enabled adapters
  eval                        Run epistemic evaluation suite
  pack                        Zeo pack commands
  analyze-pr <target>         Accountability summary for pull-request risk
  plugins <cmd>               Plugin extension commands (list/doctor)
  replay <dataset|example>    Run replay from explicit path or examples/<name>
  replay <run_id>             Deterministic replay of a snapshot (PASS/DRIFT)
  diff <runA> <runB>          Diff two runs (assumptions, outputs, confidence)
  explain <run_id>            Summarized reasoning trace for a run
  explain <decision_id>      Explain a decision from the ledger
  list --recent              List recent decisions from the ledger
  list                        List locally installed agent modules
  add <module>                Install signed module into local registry
  remove <module>             Remove module from local registry
  compose <pipeline.yaml>     Validate composed local module pipeline
  status                     Operator status and health report
  audit                      Autopilot drift monitor
  benchmark                  Performance benchmark
  trace <run_id>              Step-by-step structured execution trace
  snapshots                   List all execution snapshots
  snapshot create             Create deterministic pipeline snapshot
  snapshot list               List deterministic pipeline snapshots
  snapshot restore <id>       Restore deterministic pipeline state pointer

  plan                        Regret-aware evidence planning
  evidence <cmd>              Evidence graph commands (list/add/mark/drift/regret)
  refresh-evidence            Recalculate evidence confidence scores
  tools                       Show agent/tool health status
  init pack <name>            Initialize a policy pack template
  init analyzer <name>        Initialize analyzer plugin template
  doctor                      Environment diagnostics
  perf                        Performance commands
  cache <list|prune|gc>       Deterministic cache commands
  mcp                         MCP commands (serve/ping/tools)
  llm                         LLM commands (doctor)
  agents                      Agent plugin commands
  cp <cmd>                    ControlPlane commands (status/policy/plan/tools/doctor)
  artifacts <cmd>             Unified artifact registry commands
  zeolite <op>                Zeolite deterministic operations
  transcript <cmd>            Transcript signing and verification
  keys <cmd>                  Local keyring operations
  trust <cmd>                 Trust profile operations

  --- v8: Federated Worker Mesh ---
  mesh <cmd>                  Mesh commands (status/batch/start-worker)
  sign-envelope <file>        Sign a job envelope
  verify-envelope <file>      Verify a job/result envelope

  --- DEK: Deterministic Execution Kernel ---
  journal list                List execution journal entries
  replay <run_id>             Replay a run and verify determinism (PASS/MISMATCH/DEGRADED)

  --- Studio: Local Decision Workbench ---
  studio                       Launch Zeo Studio (local workbench UI)
  export-report <run_id>       Generate signed run report (JSON + HTML + SHA-256)
  verify-report <file>         Verify a signed report's SHA-256 integrity

  --- v3: Governed Multi-Tenant Decision Infrastructure ---
  tenant <cmd>                Tenant management (create/list/suspend/policy/usage/assign-role)
  health                      System health check report (replay, schema, policy)
  drift [clear]               Drift monitor events
  schemas [validate <name>]   Schema registry listing and validation
  compliance <cmd>            Compliance (report/audit-chain/secret-scan)
  modules <cmd>               Module registry (list/register/validate/order)
  simulate <cmd>              What-if / forecast / confidence / sensitivity
  outcome <cmd>               Outcome registration / regret analysis / optimization

Options:
  --catalog <dir>             Catalog directory (default: external/catalog)
  --example <name>            Example to run: "negotiation" or "ops" (default: negotiation)
  --depth <n>                 Branching depth: 1-5 (default: 2)
  --json-only                 Output JSON only, no summary
  --out <path>                Write JSON result to file
  --seed <string>             Random seed for deterministic runs (optional)
  --strict false              Continue on invariant violations
  --packet-out <path>         Write evidence packet (JSON + MD) to directory
  --voi                       Print Value of Information (VOI) ranked list
  --world                     Print World Model posterior state
  --emit-transcript           Emit deterministic decision transcript
  --audience <role>           Audience for explain/summary (legal|exec|sales|engineer|auditor)
  --type <ENG|OPS|SEC|PROD|MKT|CUST>  Decision type filter
  --mode <internal|customer>  Workspace mode for start
  --deterministic             Enable deterministic execution mode
  --cache <read|write|off>    Cache mode control
  --no-cache                  Disable cache
  --help, -h                  Show this help message
`);
}

function printHelpStart(): void {
  console.log(`
Zeo quick start (60 seconds)

1) Analyze something:
   zeo analyze-pr examples/analyze-pr-auth/diff.patch

2) Convert to decision:
   zeo decision create --template security-review --title "Auth rollout"

3) View dashboard:
   zeo view <run_id> --persona exec

4) Export bundle:
   zeo export decision <decision_id> --format zip

5) Apply policy pack:
   zeo pack apply security-pack
`);
}

function formatJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

function printError(code: string, message: string, details?: unknown): void {
  console.error(`[${code}] ${message}`);
  if (details && process.env.DEBUG) {
    console.error("Details:", JSON.stringify(details, null, 2));
  }
}

async function writePacketFiles(packetDir: string, json: string, markdown: string): Promise<void> {
  if (!existsSync(packetDir)) mkdirSync(packetDir, { recursive: true });
  const jsonPath = join(packetDir, "evidence.json");
  const mdPath = join(packetDir, "evidence.md");
  writeFileSync(jsonPath, `${json}\n`, "utf8");
  writeFileSync(mdPath, markdown, "utf8");
  console.log(`Evidence packet written to: ${packetDir}`);
}

function shouldReportPerf(): boolean {
  return process.env.ZEO_PERF === "1";
}

function reportPerf(startMs: number, label: string): void {
  if (!shouldReportPerf()) return;
  const total = performance.now() - startMs;
  process.stderr.write(`[zeo perf] ${label} ${total.toFixed(2)}ms\n`);
}

async function runDefaultCommand(args: CliArgs, startedMs: number): Promise<number> {
  const core = await import("@zeo/core");
  const contracts = await import("@zeo/contracts");
  const models = await import("@zeo/models");

  // Activate deterministic mode if requested
  const decisionStartMs = performance.now();
  if (args.deterministic) {
    const deterSeed = args.seed || `deterministic-${args.example}-${args.depth}`;
    core.activateDeterministicMode({ seed: deterSeed });
  }

  const spec = args.example === "ops" ? core.makeOpsExample() : core.makeNegotiationExample();
  // Capture ID counter AFTER spec generation, BEFORE engine execution
  // This allows replay to restore the counter to the same position
  const idCounterBeforeEngine = args.deterministic ? core.getDeterministicIdCounter() : 0;
  const errors: Array<InstanceType<typeof contracts.ZeoError>> = [];
  const startedAt = new Date().toISOString();

  let result;
  let transcript;
  const traceId = (process as any)._zeo_trace_id;

  try {
    if (args.emitTranscript) {
      const executed = core.executeDecision({ spec, opts: { depth: args.depth === 3 ? 3 : 2, traceId } as any, logicalTimestamp: 0 });
      result = executed.result;
      transcript = executed.transcript;
    } else {
      result = core.runDecision(spec, { depth: args.depth === 3 ? 3 : 2, traceId } as any);
    }

  } catch (err) {
    if (args.strict) {
      if (args.deterministic) core.deactivateDeterministicMode();
      const zeError = contracts.ZeoError.from(err);
      printError(zeError.code, zeError.message, zeError.details);
      return 1;
    }
    errors.push(contracts.ZeoError.from(err));
  }

  // Save execution snapshot
  if (result) {
    try {
      const snapshot = core.createSnapshot({
        spec,
        opts: { depth: args.depth, example: args.example },
        result,
        toolRegistry: core.getDefaultToolRegistry(),
        durationMs: Math.round(performance.now() - decisionStartMs),
        deterministic: args.deterministic,
        seed: args.seed,
        idCounterOffset: args.deterministic ? idCounterBeforeEngine : undefined,
      });
      const snapshotPath = core.saveSnapshot(snapshot);
      if (!args.jsonOnly) {
        console.log(`Snapshot: ${snapshot.runId} (${snapshotPath})`);
      }

      // v1.4 Premium: Decision Ledger Persistence
      const ledger = await import("@zeo/ledger");
      const artifact = ledger.createDecisionArtifact(spec, result, { depth: args.depth, example: args.example, traceId }, Math.round(performance.now() - decisionStartMs));
      const artifactPath = ledger.persistArtifact(artifact);
      if (!args.jsonOnly) {
        console.log(`Ledger: ${artifact.decision_id} (${artifactPath})`);
      }
    } catch (e) {
      // Non-fatal: snapshot/ledger save failure shouldn't break CLI
    }
  }

  if (args.deterministic) core.deactivateDeterministicMode();

  const finishedAt = new Date().toISOString();
  const decisionHash = core.hashDecisionSpec(core.canonicalizeDecisionSpec(spec));
  const seed = args.seed || core.computeDeterministicSeed(decisionHash, undefined, args.depth);

  const packet = core.buildEvidencePacket({
    decisionSpec: spec,
    decisionResult: result!,
    runMeta: {
      seed,
      depth: args.depth,
      limits: { maxBranches: 100, maxDepth: args.depth },
      startedAt,
      finishedAt,
    },
    errors,
  });

  if (args.packetOut) {
    await writePacketFiles(args.packetOut, formatJson(packet), core.buildEvidencePacketMarkdown(packet));
  }

  if (args.jsonOnly) {
    const payload = args.emitTranscript ? { packet, transcript } : packet;
    process.stdout.write(`${formatJson(payload)}\n`);
    reportPerf(startedMs, "default-json");
    return 0;
  }

  console.log("\n=== Zeo CLI ===");
  console.log(`Decision: ${spec.title}`);
  console.log(`Depth: ${args.depth}`);
  console.log(`Decision Hash: ${decisionHash.slice(0, 16)}...`);

  if (errors.length > 0) {
    console.log("\nWarnings:");
    for (const err of errors) printError(err.code, err.message);
  }

  if (result) {
    console.log(`\nBranches: ${result.graph.nodes.length} nodes, ${result.graph.edges.length} edges`);
    if (transcript) console.log(`Transcript: ${transcript.transcript_id} (${transcript.transcript_hash.slice(0, 16)}...)`);
    const robustness = result.evaluations.find(e => e.lens === "robustness");
    if (robustness) {
      console.log(`Robust actions (ids): ${robustness.robustActions.join(", ") || "none"}`);
      console.log(`Dominated actions (ids): ${robustness.dominatedActions.join(", ") || "none"}`);
    }
  }

  if (args.world) {
    const posterior = models.inferPosterior(createDemoWorldModel(), [], seed);
    printWorldState(posterior);
  }

  if (args.voi) {
    const worldSpec = createDemoWorldModel();
    const posterior = models.inferPosterior(worldSpec, [], seed);
    const voiReport = models.computeVoi(worldSpec, posterior, createDemoEvidenceCandidates(), seed, { numSimulations: 30 });
    printVoiReport(voiReport);
  }

  if (args.out) {
    writeFileSync(resolve(process.cwd(), args.out), `${formatJson(result)}\n`, "utf8");
    console.log(`\nJSON written to: ${args.out}`);
  } else {
    process.stdout.write(`\n--- Full JSON ---\n\n${formatJson(result)}\n`);
  }

  reportPerf(startedMs, "default");
  return 0;
}

async function runSignalsCommand(inputPath: string, catalogDir: string | undefined): Promise<number> {
  const resolvedPath = resolve(inputPath);
  const payload = JSON.parse(readFileSync(resolvedPath, "utf8"));
  console.log("\n=== Zeo Signals ===");
  console.log(`Input: ${inputPath}`);
  console.log(`Catalog: ${catalogDir || "default"}`);
  console.log(`Type: ${payload.type || "unknown"}`);
  console.log(`Items: ${payload.items?.length || 0}`);
  process.stdout.write(`\n--- Full Payload JSON ---\n\n${formatJson(payload)}\n`);
  return 0;
}

async function main(): Promise<void> {
  const startedMs = performance.now();
  const argv = process.argv.slice(2);

  // Lazy env init
  const dotenv = await import("dotenv");
  dotenv.config();
  const { checkEnv } = await import("@zeo/env");
  checkEnv();

  // Fast-exit paths: skip run context and logging overhead
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    reportPerf(startedMs, "help");
    process.exit(0);
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    console.log(getCliVersion());
    reportPerf(startedMs, "version");
    process.exit(0);
  }
  if (argv[0] === "help" && argv[1] === "start") {
    printHelpStart();
    process.exit(0);
  }

  const run = createRunContext();
  (process as any)._zeo_trace_id = run.trace_id; // Global trace propagation for CLI context
  log({ level: "info", msg: "cli start", run_id: run.run_id, trace_id: run.trace_id, cmd: argv[0] ?? "default", action: "start" });


  // Studio commands
  if (argv[0] === "studio") {
    const mod = await import("./studio-cli.js");
    process.exit(await mod.runStudioCommand(argv.slice(1)));
  }

  if (argv[0] === "export-report") {
    const mod = await import("./studio-cli.js");
    process.exit(await mod.runExportReportCommand(argv.slice(1)));
  }

  if (argv[0] === "verify-report") {
    const mod = await import("./studio-cli.js");
    process.exit(await mod.runVerifyReportCommand(argv.slice(1)));
  }

  if (argv[0] === "view") {
    const legacyLens = new Set(["executive", "engineering", "legal", "personal"]);
    const arg1 = argv[1] ?? "";
    if (legacyLens.has(arg1)) {
      const mod = await import("./workflow-cli.js");
      process.exit(await mod.runWorkflowCommand(mod.parseWorkflowArgs(argv)));
    }
    const mod = await import("./view-cli.js");
    process.exit(await mod.runViewCommand(mod.parseViewArgs(argv.slice(1))));
  }

  if (argv[0] === "mcp") {
    const { parseMcpArgs, runMcpCommand } = await import("./mcp-cli.js");
    process.exit(await runMcpCommand(parseMcpArgs(argv.slice(1))));
  }

  if (argv[0] === "perf") {
    const { parsePerfArgs, runPerfCommand } = await import("./perf-cli.js");
    process.exit(await runPerfCommand(parsePerfArgs(argv)));
  }

  if (argv[0] === "audit") {
    const { runAuditCommand } = await import("./audit-cli.js");
    process.exit(await runAuditCommand(argv));
  }

  // v2.0 — Trust Engine commands
  if (argv[0] === "diff" && argv[1] && argv[2]) {
    const { runDiffCommand } = await import("./trust-cli.js");
    process.exit(await runDiffCommand(argv[1], argv[2], argv.includes("--json")));
  }

  if (argv[0] === "explain" && argv[1]) {
    const id = argv[1];
    if (id.startsWith("run_")) {
      const { runExplainCommand } = await import("./trust-cli.js");
      process.exit(await runExplainCommand(id, argv.includes("--json")));
    } else {
      const { loadArtifact } = await import("@zeo/ledger");
      const artifact = loadArtifact(id);
      if (!artifact) {
        console.error(`Decision artifact ${id} not found in ledger.`);
        process.exit(1);
      }
      if (argv.includes("--json")) {
        console.log(JSON.stringify(artifact, null, 2));
      } else {
        console.log(`\n=== Zeo Decision explanation: ${artifact.decision_id} ===`);
        console.log(`Timestamp: ${artifact.timestamp}`);
        console.log(`Duration: ${artifact.execution_duration_ms}ms`);
        console.log(`Confidence: ${artifact.confidence_band.lower} - ${artifact.confidence_band.upper} (${artifact.confidence_band.method})`);
        console.log(`\nReasoning:\n${artifact.reasoning_summary}`);
        console.log(`\nSensitivities:\n${artifact.sensitivity_summary}`);
        if (artifact.flip_distance_summary.length > 0) {
          console.log(`\nFlip Distances:`);
          artifact.flip_distance_summary.forEach(fd => {
            console.log(`- ${fd.assumption_id}: dist=${fd.distance} boundary=${fd.boundary}`);
          });
        }
      }
      process.exit(0);
    }
  }

  if (argv[0] === "trace" && argv[1]) {
    const { runTraceCommand } = await import("./trust-cli.js");
    process.exit(await runTraceCommand(argv[1], argv.includes("--json")));
  }

  if (argv[0] === "snapshots") {
    const { runSnapshotsCommand } = await import("./trust-cli.js");
    process.exit(await runSnapshotsCommand(argv.includes("--json")));
  }


  if (argv[0] === "snapshot") {
    const mod = await import("./snapshot-cli.js");
    if (argv[1] === "create") process.exit(await mod.runSnapshotCreateCommand(argv.includes("--debug")));
    if (argv[1] === "list") process.exit(await mod.runSnapshotListCommand(argv.includes("--json")));
    if (argv[1] === "restore" && argv[2]) process.exit(await mod.runSnapshotRestoreCommand(argv[2]));
    console.error("Usage: zeo snapshot <create|list|restore <id>> [--json] [--debug]");
    process.exit(1);
  }

  if (argv[0] === "tools") {
    const { runToolsCommand } = await import("./tools-cli.js");
    process.exit(await runToolsCommand(argv.slice(1)));
  }

  if (argv[0] === "plan") {
    const { parsePlanArgs, runPlanCommand } = await import("./plan-cli.js");
    process.exit(await runPlanCommand(parsePlanArgs(argv.slice(1))));
  }

  if (argv[0] === "status") {
    const { runStatusCommand } = await import("./status-cli.js");
    process.exit(await runStatusCommand());
  }

  if (argv[0] === "audit") {
    const { runAuditCommand } = await import("./audit-drift-cli.js");
    process.exit(await runAuditCommand(argv.slice(1)));
  }

  if (argv[0] === "benchmark") {
    const { runBenchmarkCommand } = await import("./benchmark-cli.js");
    process.exit(await runBenchmarkCommand());
  }


  if (
    ["add", "remove", "compose", "revoke", "revocations", "verify-export"].includes(argv[0] ?? "")
    || (argv[0] === "list" && argv[1] !== "--recent")
    || (argv[0] === "export" && argv.includes("--deterministic"))
  ) {
    const mod = await import("./marketplace-cli.js");
    const rc = await mod.runMarketplaceCommand(argv);
    if (rc !== -1) process.exit(rc);
  }

  if (argv[0] === "list" && argv[1] === "--recent") {
    const { listRecentArtifacts } = await import("@zeo/ledger");
    const recent = listRecentArtifacts(20);
    console.log("\n=== Recent Decisions (Ledger) ===");
    recent.forEach(a => {
      console.log(`- ${a.decision_id}: ${a.timestamp} [${a.input_hash.slice(0, 8)}]`);
    });
    process.exit(0);
  }


  if (argv[0] === "refresh-evidence") {
    const { parseEvidenceGraphArgs, runEvidenceGraphCommand } = await import("./evidence-graph-cli.js");
    process.exit(await runEvidenceGraphCommand(parseEvidenceGraphArgs(["refresh", ...argv.slice(1)])));
  }

  const delegatedFlags = [
    ["--warehouse", "./warehouse-cli.js", "parseWarehouseArgs", "runWarehouseCommand"],
    ["--analytics", "./warehouse-cli.js", "parseAnalyticsArgs", "runAnalyticsCommand"],
    ["--regimes", "./regimes-cli.js", "parseRegimesArgs", "runRegimesCommand"],
  ] as const;

  for (const [flag, modulePath, parseFn, runFn] of delegatedFlags) {
    const idx = argv.indexOf(flag);
    if (idx !== -1) {
      const mod = await import(modulePath);
      process.exit(await mod[runFn](mod[parseFn](argv.slice(idx + 1))));
    }
  }

  if (argv[0] === "adapters" || argv[0] === "ingest") {
    const mod = await import("./adapters-runtime-cli.js");
    process.exit(await mod.runAdaptersRuntimeCommand(mod.parseAdaptersRuntimeArgs(argv[0] === "ingest" ? argv : argv.slice(1))));
  }

  if (argv[0] === "eval") {
    const mod = await import("./eval-cli.js");
    process.exit(await mod.runEvalCommand(mod.parseEvalArgs(argv.slice(1))));
  }

  if (argv[0] === "pack") {
    const mod = await import("./pack-cli.js");
    process.exit(await mod.runPackCommand(mod.parsePackArgs(argv.slice(1))));
  }

  if (argv[0] === "analyze-pr") {
    const mod = await import("./analyze-pr-cli.js");
    process.exit(await mod.runAnalyzePrCommand(argv.slice(1)));
  }

  if (argv[0] === "render") {
    const mod = await import("./render-cli.js");
    process.exit(await mod.runRenderCommand(argv.slice(1)));
  }

  if (argv[0] === "demo") {
    const mod = await import("./render-cli.js");
    process.exit(await mod.runDemoCommand(argv.slice(1)));
  }

  if (argv[0] === "share" && (argv[1] === "github" || argv[1] === "slack")) {
    const mod = await import("./render-cli.js");
    process.exit(await mod.runShareCommand(argv.slice(1)));
  }

  if (argv[0] === "plugins") {
    const mod = await import("./plugins-cli.js");
    process.exit(await mod.runPluginsCommand(mod.parsePluginsArgs(argv.slice(1))));
  }

  if (argv[0] === "init" && argv[1] === "pack") {
    const mod = await import("./pack-cli.js");
    process.exit(await mod.runPackCommand({ command: "init", value: argv[2], spec: undefined, out: undefined }));
  }

  if (argv[0] === "init" && argv[1] === "analyzer") {
    const mod = await import("./plugins-cli.js");
    process.exit(await mod.runPluginsCommand({ command: "init-analyzer", name: argv[2] }));
  }

  if (argv[0] === "replay") {
    const requested = argv[1];
    if (!requested) {
      console.error("Usage: zeo replay <run_id|path|examples/<name>> [--report-out <dir>] [--case <id>] [--json]");
      process.exit(1);
    }
    // v2.0: DEK-based deterministic replay for journal entries
    if (requested.startsWith("run_")) {
      const mod = await import("./dek-replay-cli.js");
      const args = mod.parseDekReplayArgs(argv.slice(1));
      if (!args) {
        console.error("Usage: zeo replay <run_id> [--json] [--strict] [--suggest-model] [--report-out <dir>]");
        process.exit(1);
      }
      process.exit(await mod.runDekReplayCommand(args));
    }
    const analyzeManifest = join(process.cwd(), ".zeo", "analyze-pr", requested, "manifest.json");
    if (existsSync(analyzeManifest)) {
      const mod = await import("./analyze-pr-cli.js");
      process.exit(mod.runAnalyzePrReplay(requested));
    }
    const mod = await import("./replay-cli.js");
    const replayPath = requested.startsWith("examples/") ? join(process.cwd(), requested, "replay.json") : requested;
    const parsed = mod.parseReplayArgs(["--replay", replayPath, ...argv.slice(2)]);
    process.exit(await mod.runReplayCommand(parsed));
  }

  if (argv[0] === "journal") {
    const subcmd = argv[1];
    if (subcmd === "list") {
      const mod = await import("./dek-replay-cli.js");
      await mod.listJournalRuns();
      process.exit(0);
    }
    console.error("Usage: zeo journal <list>");
    process.exit(1);
  }

  if (argv[0] === "doctor") {
    const mod = await import("./doctor-cli.js");
    process.exit(await mod.runDoctorCommand(mod.parseDoctorArgs(argv.slice(1))));
  }

  if (argv[0] === "llm") {
    const mod = await import("./llm-cli.js");
    process.exit(await mod.runLlmCommand(mod.parseLlmArgs(argv.slice(1))));
  }

  if (argv[0] === "agents") {
    const mod = await import("./agents-cli.js");
    process.exit(await mod.runAgentsCommand(mod.parseAgentsArgs(argv.slice(1))));
  }

  if (argv[0] === "cp" || argv[0] === "artifacts") {
    const mod = await import("./controlplane-cli.js");
    process.exit(await mod.runControlPlaneCommand(argv));
  }

  // v2.0: Evidence graph commands (list/add/mark/drift/regret)
  if (argv[0] === "evidence" && argv[1] && ["list", "add", "mark", "drift", "regret", "refresh"].includes(argv[1])) {
    const { parseEvidenceGraphArgs, runEvidenceGraphCommand } = await import("./evidence-graph-cli.js");
    process.exit(await runEvidenceGraphCommand(parseEvidenceGraphArgs(argv.slice(1))));
  }

  if (argv[0] === "run" && argv.includes("--debug")) {
    const mod = await import("./snapshot-cli.js");
    process.exit(await mod.runSnapshotCreateCommand(true));
  }

  if (["start", "add-note", "run", "next", "share", "copy", "export", "quests", "done", "streaks", "view", "review", "explain", "summary", "decision-health", "drift-report", "roi-report", "verify", "evidence", "help", "examples", "template", "decision"].includes(argv[0] ?? "")) {
    const mod = await import("./workflow-cli.js");
    process.exit(await mod.runWorkflowCommand(mod.parseWorkflowArgs(argv)));
  }

  if (argv[0] === "graph") {
    const mod = await import("./graph-cli.js");
    process.exit(await mod.runGraphCommand(argv));
  }


  if (argv[0] === "cache") {
    const mod = await import("./cache-cli.js");
    process.exit(await mod.runCacheCommand(mod.parseCacheArgs(argv.slice(1))));
  }

  if (["transcript", "keys", "trust", "keygen", "key"].includes(argv[0] ?? "")) {
    const mod = await import("./transcript-cli.js");
    process.exit(await mod.runTranscriptCommand(argv));
  }


  // v3.0: Governed Multi-Tenant Decision Infrastructure
  if (["tenant", "health", "drift", "schemas", "compliance", "modules", "simulate", "outcome"].includes(argv[0] ?? "")) {
    const mod = await import("./v3-cli.js");
    process.exit(await mod.runV3Command(mod.parseV3Args(argv)));
  }

  // v8: Federated Worker Mesh commands
  if (["mesh", "sign-envelope", "verify-envelope"].includes(argv[0] ?? "")) {
    const mod = await import("./mesh-cli.js");
    const meshCmd = argv[0] === "mesh" ? "mesh" : argv[0];
    process.exit(await mod.runMeshCommand(mod.parseMeshArgs(meshCmd === "mesh" ? argv.slice(0) : argv)));
  }

  if (argv[0] === "zeolite") {
    const mod = await import("./zeolite-cli.js");
    process.exit(await mod.runZeoliteCommand(mod.parseZeoliteArgs(argv.slice(1))));
  }

  if (argv[0] === "transcript") {
    const mod = await import("./transcript-cli.js");
    process.exit(await mod.runTranscriptCommand(mod.parseTranscriptArgs(argv.slice(1))));
  }

  const args = parseArgs(argv);
  if (args.replay || args.pack) {
    const mod = await import("./replay-cli.js");
    process.exit(await mod.runReplayCommand(args));
  }

  try {
    if (args.signals) {
      process.exit(await runSignalsCommand(args.signals, args.catalog));
    }
    process.exit(await runDefaultCommand(args, startedMs));
  } catch (err) {
    const contracts = await import("@zeo/contracts");
    const zeError = contracts.ZeoError.from(err);
    log({ level: "error", msg: zeError.message, run_id: run.run_id, trace_id: run.trace_id, cmd: argv[0] ?? "default", action: "fatal", error_code: zeError.code });
    printError(zeError.code, zeError.message, zeError.details);
    process.exit(1);
  } finally {
    log({ level: "info", msg: "run summary", run_id: run.run_id, trace_id: run.trace_id, cmd: argv[0] ?? "default", action: "complete", duration_ms: Math.round(performance.now() - startedMs) });
  }
}

function createDemoWorldModel(): WorldModelSpec {
  return {
    id: "demo-world",
    version: "0.3.0",
    variables: [
      { id: "market_stress", label: "Market Stress Level", domain: "market", priorBand: { low: 0.2, high: 0.8 }, volatilityHint: "medium" },
      { id: "counterparty_trust", label: "Counterparty Trust", domain: "ops", priorBand: { low: 0.4, high: 0.9 } },
      { id: "timeline_pressure", label: "Timeline Pressure", domain: "ops", priorBand: { low: 0.1, high: 0.6 } },
    ],
    observationModels: [
      { id: "market_obs", label: "Market Observation", targetVariableIds: ["market_stress"], effect: "narrow", strength: 0.5, minQualityThreshold: 0.3, provenancePattern: "market:*" },
      { id: "news_obs", label: "News Observation", targetVariableIds: ["market_stress"], effect: "widen", strength: 0.3, minQualityThreshold: 0.2, provenancePattern: "news:*" },
    ],
  };
}

function createDemoEvidenceCandidates(): EvidenceCandidate[] {
  return [
    { id: "cand1", label: "Check VIX index", kind: "market_check", targetVariableIds: ["market_stress"], expectedCost: { timeMinutes: 5, cognitiveLoad: "low" }, reliabilityBand: { low: 0.7, high: 0.9 }, provenancePlan: { wouldHavePointer: true, sourceKinds: ["bloomberg"] } },
    { id: "cand2", label: "Ask counterparty about timeline", kind: "question", targetVariableIds: ["timeline_pressure", "counterparty_trust"], expectedCost: { timeMinutes: 15, cognitiveLoad: "medium" }, reliabilityBand: { low: 0.4, high: 0.7 }, provenancePlan: { wouldHavePointer: false, sourceKinds: ["counterparty"] } },
    { id: "cand3", label: "Review past deal history", kind: "document", targetVariableIds: ["counterparty_trust"], expectedCost: { timeMinutes: 30, cognitiveLoad: "low" }, reliabilityBand: { low: 0.6, high: 0.8 }, provenancePlan: { wouldHavePointer: true, sourceKinds: ["crm", "contracts"] } },
  ];
}

function printWorldState(posterior: PosteriorState): void {
  console.log("\n=== World State (Posterior) ===");
  for (const variable of posterior.variables) {
    console.log(`${variable.variableId}: [${variable.posteriorBand.low.toFixed(2)}, ${variable.posteriorBand.high.toFixed(2)}]`);
  }
}

function printVoiReport(report: VoiReport): void {
  console.log("\n=== Value of Information (VOI) ===");
  for (const candidate of report.candidates) {
    console.log(`${candidate.candidateId}: gain=${candidate.expectedGain.toFixed(4)} score=${candidate.costAdjustedScore.toFixed(4)}`);
  }
}

const isMainModule = process.argv[1] && import.meta.url.replace(/\\/g, "/").endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMainModule) {
  process.on("unhandledRejection", (reason) => {
    const traceId = (process as any)._zeo_trace_id || "unknown";
    console.error(JSON.stringify({
      code: "UNHANDLED_REJECTION",
      message: reason instanceof Error ? reason.message : String(reason),
      hint: "An asynchronous operation failed without a catch block.",
      trace_id: traceId
    }, null, 2));
    process.exit(1);
  });

  main().catch((err) => {
    const contracts = (global as any).ZeoContracts; // Try to use global if loaded
    const traceId = (process as any)._zeo_trace_id || "unknown";

    // Structured error response
    console.error(JSON.stringify({
      code: err.code || "FATAL_ERROR",
      message: err.message || String(err),
      hint: err.hint || "Check zeo doctor for environment issues.",
      trace_id: traceId
    }, null, 2));
    process.exit(1);
  });
}
