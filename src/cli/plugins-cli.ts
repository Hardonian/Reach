import { loadConfig } from "../core/env.js";
// @ts-nocheck
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { codePointCompare } from "../determinism/deterministicCompare.js";

const API_VERSION = "1.0.0";

function repoRootFromCwd(): string {
  let current = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(current, "package.json");
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, "utf8")) as {
          name?: string;
        };
        if (pkg.name === "zeo") return current;
      } catch {
        // continue walking
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return resolve(process.cwd(), "../..");
}

type Capability =
  | "registerDecisionType"
  | "registerPolicy"
  | "registerEvidenceExtractor"
  | "registerRenderer"
  | "registerRetriever"
  | "registerAnalyzePrAnalyzer";

interface PluginManifest {
  id: string;
  version: string;
  apiVersion: string;
  deterministic: boolean;
  permissions: { network: boolean };
  capabilities: Capability[];
  entry: string;
}

export interface PluginsArgs {
  command: "list" | "doctor" | "init-analyzer" | null;
  name?: string;
}

function pluginsRoots(): string[] {
  const repoRoot = repoRootFromCwd();
  const roots = [
    resolve(repoRoot, "plugins"),
    resolve(process.cwd(), "plugins"),
    resolve(process.cwd(), ".zeo", "plugins"),
  ];
  const pluginPath = loadConfig().ZEO_PLUGIN_PATH;
  if (pluginPath) roots.push(resolve(process.cwd(), pluginPath));
  return roots;
}

function loadPluginManifests(): Array<{
  root: string;
  manifest: PluginManifest;
}> {
  const manifests: Array<{ root: string; manifest: PluginManifest }> = [];
  for (const root of pluginsRoots()) {
    if (!existsSync(root)) continue;
    const dirs = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const dir of dirs) {
      const manifestPath = join(root, dir, "plugin.json");
      if (!existsSync(manifestPath)) continue;
      const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as PluginManifest;
      manifests.push({ root: join(root, dir), manifest: raw });
    }
  }
  return manifests.sort((a, b) => codePointCompare(a.manifest.id, b.manifest.id));
}

export function parsePluginsArgs(argv: string[]): PluginsArgs {
  if (argv[0] === "init-analyzer") return { command: "init-analyzer", name: argv[1] };
  const command = argv[0] === "list" || argv[0] === "doctor" ? argv[0] : null;
  return { command };
}

function initAnalyzer(name: string | undefined): number {
  if (!name) {
    console.error("Usage: zeo init analyzer <name>");
    return 1;
  }
  const pluginDir = resolve(repoRootFromCwd(), "plugins", name);
  if (existsSync(pluginDir)) {
    console.error(`Error: plugin already exists: ${name}`);
    return 1;
  }
  mkdirSync(pluginDir, { recursive: true });
  const manifest: PluginManifest = {
    id: name,
    version: "0.1.0",
    apiVersion: API_VERSION,
    deterministic: true,
    permissions: { network: false },
    capabilities: ["registerAnalyzePrAnalyzer"],
    entry: "index.js",
  };
  writeFileSync(join(pluginDir, "plugin.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeFileSync(
    join(pluginDir, "index.js"),
    [
      "module.exports = {",
      "  register() {",
      "    return {",
      "      analyzers: [",
      "        {",
      '          id: "sample-analyzer",',
      '          category: "performance",',
      "          deterministic: true,",
      "          analyze(_input) {",
      "            return [];",
      "          }",
      "        }",
      "      ]",
      "    };",
      "  }",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  console.log(`Initialized analyzer plugin: ${pluginDir}`);
  return 0;
}

export async function runPluginsCommand(args: PluginsArgs): Promise<number> {
  if (args.command === "init-analyzer") return initAnalyzer(args.name);
  if (!args.command) {
    console.log("Usage: zeo plugins <list|doctor>");
    return 1;
  }
  const manifests = loadPluginManifests();

  if (args.command === "list") {
    for (const item of manifests) {
      console.log(
        `${item.manifest.id}@${item.manifest.version} api=${item.manifest.apiVersion} deterministic=${item.manifest.deterministic}`,
      );
    }
    return 0;
  }

  let hasErrors = false;
  for (const item of manifests) {
    const errors: string[] = [];
    if (item.manifest.apiVersion !== API_VERSION)
      errors.push(`apiVersion mismatch expected=${API_VERSION} actual=${item.manifest.apiVersion}`);
    if (!item.manifest.deterministic) errors.push("plugin must declare deterministic=true");
    if (item.manifest.permissions.network)
      errors.push("plugin network permission disabled by default");
    if (!existsSync(join(item.root, item.manifest.entry)))
      errors.push(`entry not found: ${item.manifest.entry}`);
    if (item.manifest.capabilities.length === 0) errors.push("at least one capability required");

    if (errors.length > 0) {
      hasErrors = true;
      console.log(`❌ ${item.manifest.id}`);
      for (const e of errors) console.log(`  - ${e}`);
    } else {
      console.log(`✅ ${item.manifest.id}`);
    }
  }

  return hasErrors ? 1 : 0;
}

export const __private__ = { loadPluginManifests, pluginsRoots };
