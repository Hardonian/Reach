// @ts-nocheck
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { runDecision } from "@zeo/core";
import { nanoid } from "nanoid";
import { createAssumptionTracker, buildReproPackContents, buildReproPackZip } from "@zeo/repro-pack";
import type { DecisionSpec } from "@zeo/contracts";

export interface PackCliArgs {
  command?: "list" | "apply" | "export" | "init" | "describe";
  value?: string;
  spec: string | undefined;
  out: string | undefined;
}

interface PackManifest {
  id: string;
  version: string;
  author: string;
  tags: string[];
}

const PACKS_DIR = resolve(process.cwd(), "packs");

function parsePackManifest(packDir: string): PackManifest {
  const raw = JSON.parse(readFileSync(join(packDir, "pack.json"), "utf8")) as Record<string, unknown>;
  return {
    id: String(raw.id),
    version: String(raw.version),
    author: String(raw.author),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
  };
}

function hashPack(packDir: string): string {
  const payload = readFileSync(join(packDir, "pack.json"), "utf8");
  return createHash("sha256").update(payload).digest("hex");
}

export function parsePackArgs(argv: string[]): PackCliArgs {
  const result: PackCliArgs = { spec: undefined, out: undefined };
  if (["list", "apply", "export", "init", "describe"].includes(argv[0] ?? "")) {
    result.command = argv[0] as PackCliArgs["command"];
    result.value = argv[1];
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === "--spec" || arg === "-s") && next) {
      result.spec = next;
      i++;
    } else if ((arg === "--out" || arg === "-o") && next) {
      result.out = next;
      i++;
    }
  }
  return result;
}

function listPacks(): number {
  if (!existsSync(PACKS_DIR)) {
    console.log("No packs directory found.");
    return 0;
  }
  const dirs = readdirSync(PACKS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  for (const d of dirs) {
    const dir = join(PACKS_DIR, d);
    const manifest = parsePackManifest(dir);
    const hash = hashPack(dir);
    console.log(`${manifest.id}@${manifest.version} author=${manifest.author} hash=${hash.slice(0, 12)}`);
  }
  return 0;
}


function describePack(packId: string | undefined): number {
  if (!packId) {
    console.error("Error: zeo pack describe <pack>");
    return 1;
  }
  const dir = join(PACKS_DIR, packId);
  if (!existsSync(dir)) {
    console.error(`Error: pack not found: ${packId}`);
    return 1;
  }
  const manifest = parsePackManifest(dir);
  const hash = hashPack(dir);
  const raw = JSON.parse(readFileSync(join(dir, "pack.json"), "utf8")) as Record<string, unknown>;
  process.stdout.write(`${JSON.stringify({ manifest, hash, raw }, null, 2)}\n`);
  return 0;
}
function applyPack(packId: string | undefined): number {
  if (!packId) {
    console.error("Error: zeo pack apply <pack>");
    return 1;
  }
  const src = join(PACKS_DIR, packId);
  if (!existsSync(src)) {
    console.error(`Error: pack not found: ${packId}`);
    return 1;
  }
  const manifest = parsePackManifest(src);
  const stateDir = resolve(process.cwd(), ".zeo", "packs");
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
  const statePath = join(stateDir, "active-pack.json");
  const payload = { id: manifest.id, version: manifest.version, hash: hashPack(src), applied_at: "1970-01-01T00:00:00.000Z" };
  writeFileSync(statePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Applied pack ${manifest.id}@${manifest.version}`);
  return 0;
}

function exportPacks(): number {
  if (!existsSync(PACKS_DIR)) {
    console.error("Error: packs directory missing");
    return 1;
  }
  const out = resolve(process.cwd(), ".zeo", "packs", "packs-export.json");
  mkdirSync(resolve(process.cwd(), ".zeo", "packs"), { recursive: true });
  const dirs = readdirSync(PACKS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const bundles = dirs.map((d) => {
    const dir = join(PACKS_DIR, d);
    const manifest = parsePackManifest(dir);
    return { manifest, hash: hashPack(dir) };
  });
  writeFileSync(out, `${JSON.stringify({ schema_version: "1.0.0", bundles }, null, 2)}\n`, "utf8");
  console.log(`Exported pack index: ${out}`);
  return 0;
}

function initPack(name: string | undefined): number {
  if (!name) {
    console.error("Error: zeo init pack <name>");
    return 1;
  }
  const dir = join(PACKS_DIR, name);
  if (existsSync(dir)) {
    console.error(`Error: pack already exists: ${name}`);
    return 1;
  }
  mkdirSync(join(dir, "policies"), { recursive: true });
  mkdirSync(join(dir, "templates"), { recursive: true });
  writeFileSync(join(dir, "pack.json"), `${JSON.stringify({ id: name, version: "0.1.0", author: "community", tags: ["custom"] }, null, 2)}\n`);
  writeFileSync(join(dir, "policies", "default-policy.json"), `${JSON.stringify({ id: `${name}-default`, version: "1.0.0", rules: [] }, null, 2)}\n`);
  writeFileSync(join(dir, "templates", "decision-template.md"), "# Decision Template\n\n- Context:\n- Decision:\n- Confidence range:\n");
  console.log(`Initialized pack template at ${dir}`);
  return 0;
}

function runLegacyPack(specPath: string, outPath: string): number {
  let spec: DecisionSpec;
  try {
    spec = JSON.parse(readFileSync(resolve(specPath), "utf8")) as DecisionSpec;
  } catch (err) {
    console.error(`Error reading spec: ${(err as Error).message}`);
    return 1;
  }

  const runId = nanoid();
  const requestId = nanoid();
  const tracker = createAssumptionTracker();
  const result = runDecision(spec, { tracker });

  for (const a of spec.assumptions || []) {
    if (!tracker.getAssumption(a.id)) {
      tracker.recordAssumption({
        key: a.id,
        label: "User Assumption from Spec",
        value: true,
        units: "boolean",
        source: "user",
        rationale: "Explicit in spec",
        sensitivity: "med",
        provenance: { path: "spec definition" },
      });
    }
  }

  const runData = {
    inputs: { spec },
    assumptions: tracker.getAssumptions(),
    uncertaintyMap: tracker.getUncertaintyMap(),
    artifacts: {
      flipDistance: result.explanation.whatWouldChange,
      voiRankings: result.nextBestEvidence,
      evidencePlan: { note: "Not generated in this simplified run" },
    },
    outputs: {
      graphNodes: result.graph.nodes.length,
      graphEdges: result.graph.edges.length,
      evaluations: result.evaluations,
      explanation: result.explanation,
    },
    events: tracker.getEvents(),
    seed: "deterministic-seed-placeholder",
  };

  const contents = buildReproPackContents({ runId, tenantId: "cli-local", actor: spec.context || "cli-user", requestId }, runData, "0.0.1", "unknown");
  const zipValues = buildReproPackZip(contents);
  writeFileSync(resolve(outPath), zipValues);
  console.log(`Repro pack written to: ${resolve(outPath)}`);
  return 0;
}

export async function runPackCommand(args: PackCliArgs): Promise<number> {
  if (args.command === "list") return listPacks();
  if (args.command === "apply") return applyPack(args.value);
  if (args.command === "export") return exportPacks();
  if (args.command === "init") return initPack(args.value);
  if (args.command === "describe") return describePack(args.value);

  if (!args.spec || !args.out) {
    console.error("Error: --spec <path> and --out <path> are required for legacy pack build");
    return 1;
  }
  return runLegacyPack(args.spec, args.out);
}


export const __private__ = { hashPack, parsePackManifest };

