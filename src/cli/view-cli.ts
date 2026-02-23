// @ts-nocheck
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";
import { loadOrGenerateDashboardViewModel, stableStringify } from "../lib/generateViewModel.js";
import type { DashboardPersona } from "@zeo/contracts";

export interface ViewCliArgs {
  id: string | null;
  persona?: DashboardPersona;
  open: boolean;
  json: boolean;
}

const PERSONAS: DashboardPersona[] = ["exec", "tech", "security"];

export function parseViewArgs(argv: string[]): ViewCliArgs {
  const id = argv[0] && !argv[0].startsWith("--") ? argv[0] : null;
  const personaIdx = argv.indexOf("--persona");
  const personaRaw = personaIdx >= 0 ? argv[personaIdx + 1] : undefined;
  const persona = PERSONAS.includes(personaRaw as DashboardPersona)
    ? (personaRaw as DashboardPersona)
    : undefined;
  return {
    id,
    persona,
    open: argv.includes("--open"),
    json: argv.includes("--json"),
  };
}

function writeStaticViewer(id: string, persona: DashboardPersona): string {
  const outDir = resolve(process.cwd(), ".zeo", "view", id);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Zeo Dashboard ${id}</title>
</head>
<body>
  <p>Dashboard viewer generated for ${id}. Open Zeo web route: <a href="http://localhost:3000/view/${id}?persona=${persona}">http://localhost:3000/view/${id}?persona=${persona}</a></p>
  <p>View model location: ../../viewmodels/${id}.json</p>
</body>
</html>`;
  const path = join(outDir, "index.html");
  writeFileSync(path, `${html}\n`, "utf8");
  return path;
}

function openPath(pathValue: string): void {
  try {
    if (process.platform === "darwin") execSync(`open "${pathValue}"`);
    else if (process.platform === "win32")
      execSync(`start "" "${pathValue}"`, { shell: "cmd.exe" });
    else execSync(`xdg-open "${pathValue}"`);
  } catch {
    // no hard-500s: open is best-effort.
  }
}

export async function runViewCommand(args: ViewCliArgs): Promise<number> {
  if (!args.id) {
    console.error(
      "Usage: zeo view <decisionId|runId> [--persona exec|tech|security] [--open] [--json]",
    );
    return 1;
  }

  const persona = args.persona ?? "exec";
  // Hook: deterministic view model is generated from run artifacts and persisted for replay.
  const { path: modelPath, model } = loadOrGenerateDashboardViewModel({
    id: args.id,
    persona,
  });
  // Hook: static viewer points to the same view model consumed by web route /view/[id].
  const staticPath = writeStaticViewer(args.id, persona);

  if (args.json) {
    process.stdout.write(stableStringify(model));
    return 0;
  }

  console.log(`Dashboard ViewModel: ${modelPath}`);
  console.log(`Dashboard Viewer: ${staticPath}`);
  console.log(`Dashboard Route: http://localhost:3000/view/${args.id}?persona=${persona}`);

  if (args.open) openPath(staticPath);
  return 0;
}
