// @ts-nocheck
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import {
  addLocalModule,
  listRevokedModules,
  listLocalModules,
  removeLocalModule,
  revokeModule,
  parsePipelineDefinition,
  validatePipelineCompatibility,
} from "@zeo/modules";

const MODULES_ROOT = resolve(homedir(), ".zeo", "modules");
const REVOCATION_PATH = resolve(MODULES_ROOT, "revocations.json");

export async function runMarketplaceCommand(argv: string[]): Promise<number> {
  const command = argv[0];

  if (command === "add") {
    const modulePath = argv[1];
    if (!modulePath) {
      console.error("Usage: zeo add <module>");
      return 1;
    }
    const installed = addLocalModule(modulePath, MODULES_ROOT);
    console.log(`Installed ${installed.moduleId}@${installed.version}`);
    return 0;
  }

  if (command === "remove") {
    const moduleId = argv[1];
    if (!moduleId) {
      console.error("Usage: zeo remove <module>");
      return 1;
    }
    const removed = removeLocalModule(moduleId, MODULES_ROOT);
    if (!removed) {
      console.error(`Module not found: ${moduleId}`);
      return 1;
    }
    console.log(`Removed ${moduleId}`);
    return 0;
  }

  if (command === "list") {
    const modules = listLocalModules(MODULES_ROOT);
    if (modules.length === 0) {
      console.log("No local modules installed.");
      return 0;
    }
    console.log(`=== Local Modules (${modules.length}) ===`);
    for (const mod of modules) {
      const det = mod.deterministicSupport ? "deterministic" : "nondeterministic";
      console.log(`${mod.moduleId}@${mod.version} [${det}]`);
    }
    return 0;
  }

  if (command === "revoke") {
    const moduleId = argv[1];
    if (!moduleId) {
      console.error("Usage: zeo revoke <moduleId>");
      return 1;
    }
    const changed = revokeModule(moduleId, REVOCATION_PATH);
    console.log(changed ? `Revoked ${moduleId}` : `Already revoked ${moduleId}`);
    return 0;
  }

  if (command === "revocations") {
    const revoked = listRevokedModules(REVOCATION_PATH);
    if (revoked.length === 0) {
      console.log("No revoked modules.");
      return 0;
    }
    console.log("=== Revoked Modules ===");
    for (const moduleId of revoked) {
      console.log(`- ${moduleId}`);
    }
    return 0;
  }

  if (command === "compose") {
    const pipelinePath = argv[1];
    if (!pipelinePath) {
      console.error("Usage: zeo compose <pipeline.yaml>");
      return 1;
    }
    const pipelineContent = readFileSync(resolve(pipelinePath), "utf8");
    const pipeline = parsePipelineDefinition(pipelineContent);
    const errors = validatePipelineCompatibility(pipeline, listLocalModules(MODULES_ROOT));
    if (errors.length > 0) {
      for (const error of errors) {
        console.error(`- ${error}`);
      }
      return 1;
    }
    console.log("Pipeline compatibility check passed.");
    console.log(`Execution order: ${pipeline.executionOrder.join(" -> ")}`);
    return 0;
  }

  if (command === "export" && argv.includes("--deterministic")) {
    const outputArgIdx = argv.findIndex((arg) => arg === "--out");
    const outPath = outputArgIdx >= 0 ? argv[outputArgIdx + 1] : ".zeo/export/zeo-modules-deterministic.tar";
    if (!outPath) {
      console.error("Usage: zeo export --deterministic [--out <tar-path>]");
      return 1;
    }
    const absOut = resolve(outPath);
    mkdirSync(resolve(dirnameSafe(absOut)), { recursive: true });

    const stageDir = resolve(homedir(), ".zeo", "exports", `stage-${Date.now()}`);
    rmSync(stageDir, { recursive: true, force: true });
    mkdirSync(stageDir, { recursive: true });

    copyTreeDeterministic(MODULES_ROOT, stageDir);

    execFileSync(
      "tar",
      ["--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "-cf", absOut, "-C", stageDir, "."],
      { stdio: "inherit" }
    );
    rmSync(stageDir, { recursive: true, force: true });
    console.log(`Deterministic export written: ${absOut}`);
    return 0;
  }

  if (command === "verify-export") {
    const tarPath = argv[1];
    if (!tarPath) {
      console.error("Usage: zeo verify-export <tar-path>");
      return 1;
    }
    const absTar = resolve(tarPath);
    if (!existsSync(absTar)) {
      console.error(`Export not found: ${absTar}`);
      return 1;
    }
    const listing = execFileSync("tar", ["-tvf", absTar], { encoding: "utf8" });
    const badLines = listing
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .filter((line) => !line.includes(" 1970-01-01 "));
    if (badLines.length > 0) {
      console.error("Non-deterministic mtime entries detected:");
      for (const line of badLines) console.error(`- ${line}`);
      return 1;
    }
    const hash = execFileSync("sha256sum", [absTar], { encoding: "utf8" }).split(/\s+/)[0];
    console.log(`Export verified: ${absTar}`);
    console.log(`sha256=${hash}`);
    return 0;
  }

  return -1;
}

function dirnameSafe(path: string): string {
  const pieces = path.split("/");
  pieces.pop();
  return pieces.join("/") || ".";
}

function copyTreeDeterministic(source: string, dest: string): void {
  if (!existsSync(source)) {
    mkdirSync(dest, { recursive: true });
    return;
  }
  const stack = [source];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const srcPath = join(current, entry.name);
      const rel = relative(source, srcPath);
      const dstPath = join(dest, rel);
      if (entry.isDirectory()) {
        mkdirSync(dstPath, { recursive: true });
        stack.push(srcPath);
      } else if (entry.isFile()) {
        const content = readFileSync(srcPath);
        mkdirSync(dirnameSafe(dstPath), { recursive: true });
        writeFileSync(dstPath, content);
      }
    }
  }
}

