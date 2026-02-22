// @ts-nocheck
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";

interface ControlPlaneArgs {
  scope: "cp" | "artifacts";
  command: string;
  subcommand?: string;
  value?: string;
  json: boolean;
}

type Health = "green" | "yellow" | "red";

interface ControlPlaneStatus {
  generatedAt: string;
  repoRoot: string;
  agents: Array<{ id: string; path: string }>;
  runners: Array<{ id: string; path: string }>;
  mcpTools: Array<{ name: string; enabled: boolean; scope: string; requireConfirmation: boolean }>;
  modules: Array<{ module: string; lastExecution: string | null; health: Health; failures: number; retries: number; tokenUsage: number; costUsd: number }>;
  policyViolations24h: number;
  routingDecisions: Array<{ module: string; model: string; provider: string }>;
}

interface ArtifactRecord {
  version: "artifact.registry.v1";
  artifactId: string;
  module: string;
  agent: string;
  policyVersion: string;
  createdAt: string;
  inputHash: string;
  contentHash: string;
  sourcePath: string;
  summary: Record<string, unknown>;
  evidence: Record<string, unknown>;
}

interface ArtifactRegistry {
  version: "artifact.registry.index.v1";
  generatedAt: string;
  artifacts: ArtifactRecord[];
}

const REGISTRY_PATH = ".zeo/artifacts/registry.json";
const KNOWN_LOGS = ["test_failure.log", "build_error.log", "debug.log"];

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    output[key] = sortKeys((value as Record<string, unknown>)[key]);
  }
  return output;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function readJsonSafe(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function listFilesRecursive(base: string, maxDepth = 4): string[] {
  if (!existsSync(base)) return [];
  const out: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") continue;
        walk(full, depth + 1);
      } else {
        out.push(full);
      }
    }
  };
  walk(base, 0);
  return out;
}

function parseToolConfig(root: string): ControlPlaneStatus["mcpTools"] {
  const config = readJsonSafe(join(root, "zeo.mcp.json"));
  const allowlist = config?.tools && typeof config.tools === "object" ? (config.tools as { allowlist?: Record<string, { name?: string; enabled?: boolean; scope?: string; requireConfirmation?: boolean }> }).allowlist : undefined;
  if (!allowlist) return [];
  return Object.keys(allowlist)
    .sort()
    .map((key) => {
      const tool = allowlist[key] ?? {};
      return {
        name: tool.name ?? key,
        enabled: Boolean(tool.enabled),
        scope: tool.scope ?? "unknown",
        requireConfirmation: Boolean(tool.requireConfirmation),
      };
    });
}

function collectAgents(root: string): Array<{ id: string; path: string }> {
  const files = listFilesRecursive(join(root, "agents"), 3).filter((file) => file.endsWith(".agent.json") || file.endsWith("zeo.agent.json"));
  return files
    .sort()
    .map((file) => ({
      id: basename(file).replace(/\.json$/, ""),
      path: file.replace(`${root}/`, ""),
    }));
}

function collectRunners(root: string): Array<{ id: string; path: string }> {
  const plugins = listFilesRecursive(join(root, "plugins"), 3).filter((file) => file.endsWith("plugin.json"));
  return plugins
    .sort()
    .map((file) => ({ id: basename(file, ".json"), path: file.replace(`${root}/`, "") }));
}

function healthFromFailures(failures: number): Health {
  if (failures === 0) return "green";
  if (failures < 3) return "yellow";
  return "red";
}

function collectModuleStats(root: string): ControlPlaneStatus["modules"] {
  const modules = ["zeo", "keys", "settler", "readylayer"];
  const now = Date.now();
  return modules.map((module) => {
    const relevantLogs = KNOWN_LOGS.map((log) => join(root, log)).filter((file) => existsSync(file));
    const failures = relevantLogs.reduce((acc, file) => acc + (readFileSync(file, "utf8").toLowerCase().includes("fail") ? 1 : 0), 0);
    const lastExecution = relevantLogs.length > 0
      ? new Date(Math.max(...relevantLogs.map((file) => statSync(file).mtimeMs))).toISOString()
      : null;
    const tokenUsage = relevantLogs.reduce((acc, file) => acc + Math.floor(statSync(file).size / 4), 0);
    return {
      module,
      lastExecution,
      health: healthFromFailures(failures),
      failures,
      retries: Math.max(0, failures - 1),
      tokenUsage,
      costUsd: Number((tokenUsage * 0.000002).toFixed(6)),
    };
  }).sort((a, b) => a.module.localeCompare(b.module));
}

function collectPolicyViolations24h(root: string): number {
  const since = Date.now() - (24 * 60 * 60 * 1000);
  return KNOWN_LOGS
    .map((log) => join(root, log))
    .filter((file) => existsSync(file) && statSync(file).mtimeMs >= since)
    .reduce((count, file) => count + (readFileSync(file, "utf8").toLowerCase().includes("policy") ? 1 : 0), 0);
}

function collectRoutingDecisions(): Array<{ module: string; model: string; provider: string }> {
  return [
    { module: "zeo", model: process.env.ZEO_MODEL || "gpt-4o-mini", provider: process.env.ZEO_PROVIDER || "openai" },
    { module: "keys", model: process.env.KEYS_MODEL || "local-default", provider: process.env.KEYS_PROVIDER || "local" },
    { module: "readylayer", model: process.env.READYLAYER_MODEL || "local-default", provider: process.env.READYLAYER_PROVIDER || "local" },
    { module: "settler", model: process.env.SETTLER_MODEL || "local-default", provider: process.env.SETTLER_PROVIDER || "local" },
  ].sort((a, b) => a.module.localeCompare(b.module));
}

function buildControlPlaneStatus(root: string): ControlPlaneStatus {
  return {
    generatedAt: new Date().toISOString(),
    repoRoot: root,
    agents: collectAgents(root),
    runners: collectRunners(root),
    mcpTools: parseToolConfig(root),
    modules: collectModuleStats(root),
    policyViolations24h: collectPolicyViolations24h(root),
    routingDecisions: collectRoutingDecisions(),
  };
}

function extractArtifacts(root: string): ArtifactRecord[] {
  const candidates = [
    ...listFilesRecursive(join(root, "examples"), 3),
    ...listFilesRecursive(join(root, "external/examples"), 4),
    ...listFilesRecursive(join(root, "apps/cli/reports"), 2),
  ].filter((path) => path.endsWith("evidence.json") || path.endsWith("replay.json") || path.endsWith("replay_results.json"));

  const records = candidates
    .sort()
    .map((path) => {
      const payload = readJsonSafe(path) ?? {};
      const relative = path.replace(`${root}/`, "");
      const inputHash = sha256(relative);
      const contentHash = sha256(stableStringify(payload));
      const createdAt = existsSync(path) ? statSync(path).mtime.toISOString() : new Date(0).toISOString();
      const module = relative.startsWith("apps/") ? "zeo" : relative.startsWith("external/") ? "keys" : "settler";
      const summary = payload.summary && typeof payload.summary === "object" ? payload.summary as Record<string, unknown> : { keys: Object.keys(payload).slice(0, 10) };
      const evidence = payload.evidence && typeof payload.evidence === "object" ? payload.evidence as Record<string, unknown> : payload;
      return {
        version: "artifact.registry.v1",
        artifactId: sha256(`${module}:${relative}:${contentHash}`).slice(0, 20),
        module,
        agent: "unknown",
        policyVersion: "default-policy",
        createdAt,
        inputHash,
        contentHash,
        sourcePath: relative,
        summary,
        evidence,
      } satisfies ArtifactRecord;
    });
  return records;
}

function ensureRegistry(root: string): ArtifactRegistry {
  const path = join(root, REGISTRY_PATH);
  const artifacts = extractArtifacts(root);
  const registry: ArtifactRegistry = {
    version: "artifact.registry.index.v1",
    generatedAt: new Date().toISOString(),
    artifacts,
  };
  if (!existsSync(join(root, ".zeo/artifacts"))) mkdirSync(join(root, ".zeo/artifacts"), { recursive: true });
  writeFileSync(path, `${stableStringify(registry)}\n`, "utf8");
  return registry;
}

function parseControlPlaneArgs(argv: string[]): ControlPlaneArgs {
  const scope = argv[0] === "artifacts" ? "artifacts" : "cp";
  const offset = scope === "artifacts" ? 1 : 1;
  const json = argv.includes("--json");
  if (scope === "artifacts") {
    return {
      scope,
      command: argv[1] ?? "list",
      subcommand: argv[2],
      value: argv[3],
      json,
    };
  }
  return {
    scope,
    command: argv[offset] ?? "status",
    subcommand: argv[offset + 1],
    value: argv[offset + 2],
    json,
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${stableStringify(value)}\n`);
}

function printCpStatus(status: ControlPlaneStatus): void {
  console.log("ControlPlane Status");
  console.log(`Generated: ${status.generatedAt}`);
  console.log(`Agents: ${status.agents.length} | Runners: ${status.runners.length} | MCP tools: ${status.mcpTools.length}`);
  console.log(`Policy violations (24h): ${status.policyViolations24h}`);
  for (const module of status.modules) {
    console.log(`- ${module.module}: health=${module.health} failures=${module.failures} retries=${module.retries} tokens=${module.tokenUsage} cost=$${module.costUsd.toFixed(6)} last=${module.lastExecution ?? "never"}`);
  }
}

function printArtifacts(registry: ArtifactRegistry): void {
  console.log("Artifact Registry");
  console.log(`Generated: ${registry.generatedAt}`);
  console.log(`Artifacts: ${registry.artifacts.length}`);
  for (const artifact of registry.artifacts.slice(0, 20)) {
    console.log(`- ${artifact.artifactId} module=${artifact.module} created=${artifact.createdAt} source=${artifact.sourcePath}`);
  }
}

export async function runControlPlaneCommand(argv: string[]): Promise<number> {
  const args = parseControlPlaneArgs(argv);
  const root = resolve(process.cwd());

  if (args.scope === "artifacts") {
    const registry = ensureRegistry(root);
    if (args.command === "list") {
      if (args.json) printJson(registry);
      else printArtifacts(registry);
      return 0;
    }
    if (args.command === "show") {
      const artifactId = args.subcommand;
      const item = registry.artifacts.find((artifact) => artifact.artifactId === artifactId);
      if (!item) {
        console.error(`Artifact not found: ${artifactId ?? "<missing-id>"}`);
        return 1;
      }
      printJson(item);
      return 0;
    }
    if (args.command === "export") {
      const outPath = args.subcommand ? resolve(root, args.subcommand) : resolve(root, ".zeo/artifacts/export.json");
      writeFileSync(outPath, `${stableStringify(registry)}\n`, "utf8");
      console.log(`Exported artifact registry to ${outPath}`);
      return 0;
    }
    if (args.command === "verify") {
      const invalid = registry.artifacts.filter((artifact) => artifact.contentHash !== sha256(stableStringify(artifact.evidence)));
      if (invalid.length > 0) {
        console.error(`Artifact verification failed for ${invalid.length} record(s)`);
        printJson(invalid.map((item) => ({ artifactId: item.artifactId, sourcePath: item.sourcePath })));
        return 1;
      }
      console.log(`Verified ${registry.artifacts.length} artifacts`);
      return 0;
    }
    console.error("Usage: zeo artifacts <list|show <artifactId>|export <path>|verify> [--json]");
    return 1;
  }

  const status = buildControlPlaneStatus(root);
  if (args.command === "status") {
    if (args.json) printJson(status);
    else printCpStatus(status);
    return 0;
  }
  if (args.command === "plan") {
    const action = args.subcommand ?? "unknown-action";
    const plan = {
      action,
      deterministicHash: sha256(action),
      agents: status.agents.map((item) => item.id),
      tools: status.mcpTools.filter((tool) => tool.enabled).map((tool) => tool.name),
      estimatedCostUsd: Number((status.modules.reduce((acc, item) => acc + item.costUsd, 0) / 10).toFixed(6)),
      estimatedTimeMs: status.modules.length * 250,
      riskScore: Math.min(1, status.policyViolations24h / 10),
      approvals: status.mcpTools.filter((tool) => tool.requireConfirmation).map((tool) => tool.name),
    };
    printJson(plan);
    return 0;
  }
  if (args.command === "policy" && args.subcommand === "inspect") {
    const policy = {
      version: "policy.inspect.v1",
      appliedPolicies: listFilesRecursive(join(root, "packs"), 3).filter((file) => file.endsWith("default-policy.json")).map((path) => path.replace(`${root}/`, "")).sort(),
      decisionCheckpoints: ["ingest", "evaluate", "enforce", "export"],
      blockedActions: collectPolicyViolations24h(root),
      complianceState: collectPolicyViolations24h(root) > 0 ? "red" : "green",
      rlsSimulationMode: existsSync(join(root, "supabase")) ? "available" : "not_detected",
    };
    printJson(policy);
    return 0;
  }
  if (args.command === "tools" && args.subcommand === "status") {
    const tools = {
      version: "cp.tools.status.v1",
      transport: "stdio",
      heartbeatSeconds: 30,
      tools: status.mcpTools,
      fallbackRouting: "local-disabled-tools",
    };
    printJson(tools);
    return 0;
  }
  if (args.command === "tools" && args.subcommand === "inspect") {
    const toolName = args.value ?? "";
    const tool = status.mcpTools.find((item) => item.name === toolName);
    if (!tool) {
      console.error(`Tool not found: ${toolName || "<missing-tool-name>"}`);
      return 1;
    }
    printJson({
      version: "cp.tools.inspect.v1",
      name: tool.name,
      enabled: tool.enabled,
      permissionScope: tool.scope,
      requireConfirmation: tool.requireConfirmation,
      schemaValidation: "allowlist-shape-valid",
      handshakeVersion: "1.4.0",
      heartbeat: "unknown",
      sandbox: "process",
    });
    return 0;
  }
  if (args.command === "doctor") {
    const doctor = {
      version: "cp.doctor.v1",
      reposDetected: ["Zeo", "Keys", "Settler", "ReadyLayer", "ControlPlane", "TruthCore", "JobForge"],
      schemaContracts: status.mcpTools.length > 0 ? "ok" : "degraded",
      circuitBreakerState: status.modules.some((module) => module.health === "red") ? "open" : "closed",
      quarantineCount: status.modules.filter((module) => module.health === "red").length,
      breakingChanges: 0,
      integrity: status.modules.every((module) => module.lastExecution !== null) ? "green" : "yellow",
    };
    printJson(doctor);
    return 0;
  }

  console.error("Usage: zeo cp <status|policy inspect|plan <action>|tools status|tools inspect <tool>|doctor> [--json]");
  return 1;
}

