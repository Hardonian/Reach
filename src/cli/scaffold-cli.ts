/**
 * Scaffold CLI - Project scaffolding commands
 *
 * Commands:
 *   scaffold pack <name> [--template <tpl>]   Create a new pack
 *   scaffold plugin <name> --type <type>      Create a new plugin
 *   scaffold config                           Create project config
 *   scaffold list                             List available templates
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface ScaffoldArgs {
  command: "pack" | "plugin" | "config" | "list" | null;
  name?: string;
  template?: string;
  type?: string;
}

interface Template {
  name: string;
  description: string;
  variables: Array<{
    name: string;
    prompt: string;
    required?: boolean;
    default?: string;
    validate?: string;
  }>;
  output?: string;
}

interface TemplateSet {
  [key: string]: {
    template: Template;
    files: string[];
  };
}

const TEMPLATES_DIR = resolve(process.cwd(), "templates");

function loadTemplates(category: string): TemplateSet {
  const categoryDir = join(TEMPLATES_DIR, category);
  if (!existsSync(categoryDir)) return {};

  const templates: TemplateSet = {};
  const dirs = readdirSyncSafe(categoryDir);

  for (const dir of dirs) {
    const templateJsonPath = join(categoryDir, dir, "template.json");
    if (!existsSync(templateJsonPath)) continue;

    try {
      const template: Template = JSON.parse(
        readFileSync(templateJsonPath, "utf8"),
      );
      const files = readdirSyncSafe(join(categoryDir, dir)).filter(
        (f) => f.endsWith(".template") || f === "template.json",
      );
      templates[dir] = { template, files };
    } catch {
      // Skip invalid templates
    }
  }

  return templates;
}

function readdirSyncSafe(dir: string): string[] {
  try {
    return require("node:fs")
      .readdirSync(dir, { withFileTypes: true })
      .filter((d: { isDirectory: () => boolean }) => d.isDirectory())
      .map((d: { name: string }) => d.name);
  } catch {
    return [];
  }
}

function substituteVariables(
  content: string,
  variables: Record<string, string>,
): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, value);
  }
  // Special variables
  result = result.replace(/\\{\\{now\\.iso\\}\\}/g, new Date().toISOString());
  return result;
}

function scaffoldPack(name: string, templateName: string): number {
  const templates = loadTemplates("pack");
  const selected = templates[templateName];

  if (!selected) {
    console.error(`Template not found: ${templateName}`);
    console.log(`Available: ${Object.keys(templates).join(", ")}`);
    return 1;
  }

  const outputDir = resolve(process.cwd(), "packs", name);
  if (existsSync(outputDir)) {
    console.error(`Pack already exists: ${outputDir}`);
    return 1;
  }

  // Collect variable values (in real implementation, these would be prompted)
  const variables: Record<string, string> = {
    name,
    description: "A Reach execution pack",
    author: "local",
    version: "1.0.0",
    license: "MIT",
    created: new Date().toISOString(),
  };

  mkdirSync(outputDir, { recursive: true });

  // Copy template files
  const templateDir = join(TEMPLATES_DIR, "pack", templateName);
  for (const file of selected.files) {
    if (file === "template.json") continue;

    const sourcePath = join(templateDir, file);
    const targetName = file.replace(".template", "");
    const targetPath = join(outputDir, targetName);

    const content = readFileSync(sourcePath, "utf8");
    const processed = substituteVariables(content, variables);
    writeFileSync(targetPath, processed, "utf8");
  }

  console.log(`✅ Created pack: ${outputDir}`);
  console.log(`   Template: ${templateName}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Edit ${join(name, "pack.json")}`);
  console.log(`  2. Add your execution steps`);
  console.log(`  3. Run with: reach run local.${name}`);

  return 0;
}

function scaffoldPlugin(
  name: string,
  type: string,
  _templateName: string,
): number {
  const templates = loadTemplates("plugin");
  const selected = templates[type];

  if (!selected) {
    console.error(`Plugin type not found: ${type}`);
    console.log(`Available: ${Object.keys(templates).join(", ")}`);
    return 1;
  }

  const outputDir = resolve(process.cwd(), "plugins", name);
  if (existsSync(outputDir)) {
    console.error(`Plugin already exists: ${outputDir}`);
    return 1;
  }

  const variables: Record<string, string> = {
    name,
    description: `A ${type} plugin for Reach`,
    author: "local",
    version: "1.0.0",
    license: "MIT",
  };

  mkdirSync(outputDir, { recursive: true });

  const templateDir = join(TEMPLATES_DIR, "plugin", type);
  for (const file of selected.files) {
    if (file === "template.json") continue;

    const sourcePath = join(templateDir, file);
    const targetName = file.replace(".template", "");
    const targetPath = join(outputDir, targetName);

    const content = readFileSync(sourcePath, "utf8");
    const processed = substituteVariables(content, variables);
    writeFileSync(targetPath, processed, "utf8");
  }

  console.log(`✅ Created plugin: ${outputDir}`);
  console.log(`   Type: ${type}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Edit ${join(name, "index.js")}`);
  console.log(`  2. Implement your ${type} logic`);
  console.log(`  3. Validate with: reach plugins doctor`);

  return 0;
}

function scaffoldConfig(): number {
  const templates = loadTemplates("config");
  const selected = Object.values(templates)[0];

  if (!selected) {
    console.error("No config template found");
    return 1;
  }

  const outputPath = resolve(
    process.cwd(),
    selected.template.output || "reach.config.json",
  );
  if (existsSync(outputPath)) {
    console.error(`Config already exists: ${outputPath}`);
    return 1;
  }

  const variables: Record<string, string> = {
    project_name: "my-reach-project",
    project_description: "A Reach project",
  };

  const templateDir = join(TEMPLATES_DIR, "config");
  const sourceFile = selected.files.find((f) => f.endsWith(".template"));

  if (sourceFile) {
    const content = readFileSync(join(templateDir, sourceFile), "utf8");
    const processed = substituteVariables(content, variables);
    writeFileSync(outputPath, processed, "utf8");
  }

  console.log(`✅ Created config: ${outputPath}`);
  console.log(`\nEdit this file to customize your project settings.`);

  return 0;
}

function listTemplates(): number {
  console.log("📦 Available Templates\n");

  const categories = ["pack", "plugin", "config"];

  for (const category of categories) {
    const templates = loadTemplates(category);
    if (Object.keys(templates).length === 0) continue;

    console.log(`${category.toUpperCase()}:`);
    for (const [id, { template }] of Object.entries(templates)) {
      console.log(`  ${id.padEnd(15)} - ${template.description}`);
    }
    console.log("");
  }

  console.log("Usage:");
  console.log("  reach scaffold pack <name> [--template <tpl>]");
  console.log("  reach scaffold plugin <name> --type <type>");
  console.log("  reach scaffold config");

  return 0;
}

export function parseScaffoldArgs(argv: string[]): ScaffoldArgs {
  const command = argv[0] as ScaffoldArgs["command"];
  const name = argv[1];

  let template: string | undefined;
  let type: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--template" && argv[i + 1]) {
      template = argv[i + 1];
      i++;
    }
    if (argv[i] === "--type" && argv[i + 1]) {
      type = argv[i + 1];
      i++;
    }
  }

  return { command, name, template, type };
}

export async function runScaffoldCommand(args: ScaffoldArgs): Promise<number> {
  if (args.command === "list") {
    return listTemplates();
  }

  if (!args.command) {
    console.log("Usage: reach scaffold <pack|plugin|config|list> [options]");
    return 1;
  }

  switch (args.command) {
    case "pack": {
      if (!args.name) {
        console.error("Usage: reach scaffold pack <name> [--template <tpl>]");
        return 1;
      }
      return scaffoldPack(args.name, args.template || "standard");
    }

    case "plugin": {
      if (!args.name) {
        console.error("Usage: reach scaffold plugin <name> --type <type>");
        return 1;
      }
      if (!args.type) {
        console.error(
          "Error: --type is required (analyzer|renderer|retriever)",
        );
        return 1;
      }
      return scaffoldPlugin(args.name, args.type, args.template || "default");
    }

    case "config": {
      return scaffoldConfig();
    }

    default:
      console.error(`Unknown scaffold command: ${args.command}`);
      return 1;
  }
}
