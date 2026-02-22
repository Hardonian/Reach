// @ts-nocheck
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { basename, resolve } from "node:path";

export interface AgentsArgs {
  command: "list" | "add" | "remove" | "inspect" | "recommend" | null;
  value?: string;
  accept: boolean;
  json: boolean;
}

interface AgentManifest {
  id: string;
  version: string;
  capabilities: string[];
  requiredTools: string[];
  requiredEnvVars: string[];
  permissions: { fs: boolean; network: boolean };
}

function agentsRoot(): string {
  return resolve(process.cwd(), ".zeo/agents");
}

function readManifest(path: string): AgentManifest {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.version !== "string") throw new Error(`Invalid manifest ${path}`);
  return {
    id: raw.id,
    version: raw.version,
    capabilities: Array.isArray(raw.capabilities) ? raw.capabilities.map(String) : [],
    requiredTools: Array.isArray(raw.requiredTools) ? raw.requiredTools.map(String) : [],
    requiredEnvVars: Array.isArray(raw.requiredEnvVars) ? raw.requiredEnvVars.map(String) : [],
    permissions: {
      fs: Boolean((raw.permissions as Record<string, unknown> | undefined)?.fs),
      network: Boolean((raw.permissions as Record<string, unknown> | undefined)?.network),
    },
  };
}

export function parseAgentsArgs(argv: string[]): AgentsArgs {
  const command = ["list", "add", "remove", "inspect", "recommend"].includes(argv[0] ?? "") ? argv[0] as AgentsArgs["command"] : null;
  const taskIdx = argv.indexOf("--task");
  // If parsing 'agents recommend --task foo', argv[0] is 'recommend'.
  const value = taskIdx >= 0 ? argv[taskIdx + 1] : argv[1];
  return { command, value, accept: argv.includes("--accept"), json: argv.includes("--json") };
}

function ensureRoot(): void {
  if (!existsSync(agentsRoot())) mkdirSync(agentsRoot(), { recursive: true });
}

export async function runAgentsCommand(args: AgentsArgs): Promise<number> {
  ensureRoot();
  if (!args.command) {
    console.log("Usage: zeo agents <list|add|remove|inspect|recommend>");
    return 1;
  }


  if (args.command === "recommend") {
    const task = args.value ?? "generic";
    const dirs = readdirSync(agentsRoot(), { withFileTypes: true }).filter((d) => d.isDirectory());
    const recommendations = dirs.map((dir) => {
      const manifest = readManifest(resolve(agentsRoot(), dir.name, "zeo.agent.json"));
      const capabilityMatches = manifest.capabilities.filter((cap) => cap.includes(task)).length;
      const trustPath = resolve(process.cwd(), ".zeo", "trust", "profiles.json");
      let acceptanceRatio = 0;
      if (existsSync(trustPath)) {
        const raw = JSON.parse(readFileSync(trustPath, "utf8")) as Record<string, { accepted?: number; rejected?: number; byCapability?: Record<string, { accepted: number; rejected: number }> }>;
        const entry = raw[manifest.id];
        if (entry?.byCapability && entry.byCapability[task]) {
          const cap = entry.byCapability[task];
          acceptanceRatio = (cap.accepted ?? 0) / Math.max(1, (cap.accepted ?? 0) + (cap.rejected ?? 0));
        } else if (entry) {
          acceptanceRatio = (entry.accepted ?? 0) / Math.max(1, (entry.accepted ?? 0) + (entry.rejected ?? 0));
        }
      }
      const score = capabilityMatches * 100 + Math.round(acceptanceRatio * 100);
      return { agent: manifest.id, capabilityMatches, acceptanceRatio: Number(acceptanceRatio.toFixed(4)), score };
    }).sort((a, b) => b.score - a.score || a.agent.localeCompare(b.agent));
    if (args.json) process.stdout.write(`${JSON.stringify({ task, recommendations }, null, 2)}\n`);
    else for (const rec of recommendations) console.log(`${rec.agent} score=${rec.score} acceptance=${rec.acceptanceRatio}`);
    return 0;
  }
  if (args.command === "list") {
    const dirs = readdirSync(agentsRoot(), { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const dir of dirs) console.log(dir.name);
    return 0;
  }

  if (args.command === "add") {
    if (!args.value) throw new Error("add requires local path");
    const source = resolve(process.cwd(), args.value);
    const manifestPath = resolve(source, "zeo.agent.json");
    if (!existsSync(manifestPath)) throw new Error("Missing zeo.agent.json in agent source");
    const manifest = readManifest(manifestPath);
    const permissions = { fs: manifest.permissions.fs, network: manifest.permissions.network };
    if (!args.accept) {
      const msg = {
        action: "agent_add_requires_acceptance",
        agent: manifest.id,
        permissions,
        next_step: "Re-run with --accept to install this agent.",
      };
      if (args.json) process.stdout.write(`${JSON.stringify(msg, null, 2)}\n`);
      else console.log(`Agent ${manifest.id} requests permissions fs=${permissions.fs} network=${permissions.network}. Re-run with --accept.`);
      return 1;
    }
    if (manifest.permissions.fs || manifest.permissions.network) {
      throw new Error("Agent permissions exceed default sandbox. Set fs/network to false and use explicit runtime escalation.");
    }
    const target = resolve(agentsRoot(), manifest.id);
    rmSync(target, { recursive: true, force: true });
    cpSync(source, target, { recursive: true });
    console.log(`added ${manifest.id}`);
    return 0;
  }

  if (args.command === "remove") {
    if (!args.value) throw new Error("remove requires agent id");
    const target = resolve(agentsRoot(), basename(args.value));
    rmSync(target, { recursive: true, force: true });
    console.log(`removed ${basename(args.value)}`);
    return 0;
  }

  if (!args.value) throw new Error("inspect requires agent id");
  const manifestPath = resolve(agentsRoot(), basename(args.value), "zeo.agent.json");
  const manifest = readManifest(manifestPath);
  const trustPath = resolve(process.cwd(), ".zeo", "trust", "profiles.json");
  let trust = { accepted: 0, rejected: 0 };
  if (existsSync(trustPath)) {
    const raw = JSON.parse(readFileSync(trustPath, "utf8")) as Record<string, unknown>;
    const entry = raw[manifest.id] as Record<string, unknown> | undefined;
    if (entry) trust = { accepted: Number(entry.accepted ?? 0), rejected: Number(entry.rejected ?? 0) };
  }
  const inspection = { ...manifest, toolCalls: manifest.requiredTools, trust };
  console.log(JSON.stringify(inspection, null, 2));

  const lockPath = resolve(agentsRoot(), basename(args.value), "zeo.agent.lock.json");
  writeFileSync(lockPath, `${JSON.stringify({
    mode: "proposal_only",
    mutableStateAccess: false,
    allowedToolSurface: manifest.requiredTools,
    sandbox: { fs: false, network: false },
  }, null, 2)}\n`, "utf8");

  return 0;
}

