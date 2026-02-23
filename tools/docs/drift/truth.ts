import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "../../..");
const ARTIFACTS_DIR = path.join(REPO_ROOT, ".artifacts/docs-drift");

const TRUTH_FILES = [
  "README.md",
  "AGENTS.md",
  "SKILLS.md",
  "MODEL_SPEC.md",
  "SECURITY.md",
  "CHANGELOG.md",
];

interface TruthIssue {
  file: string;
  reference: string;
  type: "file" | "command" | "env";
  message: string;
}

interface TruthReport {
  timestamp: string;
  issues: TruthIssue[];
}

function getPackageScripts(): Set<string> {
  const scripts = new Set<string>();
  const rootPkg = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"),
  );
  Object.keys(rootPkg.scripts || {}).forEach((s) => scripts.add(s));

  // Also check apps/arcade
  const arcadePkg = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "apps/arcade/package.json"), "utf-8"),
  );
  Object.keys(arcadePkg.scripts || {}).forEach((s) => scripts.add(s));

  return scripts;
}

function getEnvVars(): Set<string> {
  const envs = new Set<string>();
  const envExamplePath = path.join(REPO_ROOT, ".env.example");
  if (fs.existsSync(envExamplePath)) {
    const content = fs.readFileSync(envExamplePath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      const match = line.match(/^([A-Z0-9_]+)=/);
      if (match) envs.add(match[1]);
    }
  }
  return envs;
}

const IS_FIX_MODE = process.argv.includes("--fix");

function validateTruth() {
  console.log("--- Repo Truth Validator ---");
  if (IS_FIX_MODE) console.log("FIX MODE ENABLED");

  const scripts = getPackageScripts();
  const envs = getEnvVars();
  const issues: TruthIssue[] = [];
  let fixesApplied = 0;

  for (const truthFile of TRUTH_FILES) {
    const filePath = path.join(REPO_ROOT, truthFile);
    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, "utf-8");
    const originalContent = content;

    // 1. Validate file references: `path/to/file`
    const pathRegex = /`([^`\s]+\/[^`\s]+)`/g;
    let match;
    while ((match = pathRegex.exec(content)) !== null) {
      const refPath = match[1];
      if (
        refPath.includes("://") ||
        refPath.startsWith("npm ") ||
        refPath.startsWith("pnpm ") ||
        refPath.startsWith("node ") ||
        refPath.includes("*")
      )
        continue;

      const fullPath = path.join(REPO_ROOT, refPath);
      if (!fs.existsSync(fullPath)) {
        issues.push({
          file: truthFile,
          reference: refPath,
          type: "file",
          message: `File reference does not exist: ${refPath}`,
        });
      }
    }

    // 2. Validate commands: `npm run ...` or `pnpm ...`
    const commandRegex = /`(npm run|pnpm|yarn) ([^`]+)`/g;
    while ((match = commandRegex.exec(content)) !== null) {
      const tool = match[1];
      const fullCmd = match[2].trim();
      const cmd = fullCmd.split(" ")[0];

      if (!scripts.has(cmd)) {
        issues.push({
          file: truthFile,
          reference: match[0],
          type: "command",
          message: `Command referenced but not found in package.json: ${cmd}`,
        });

        if (IS_FIX_MODE) {
          // Check for common prefix issues or misspellings if logic added
          // For now, only 1:1 mapping if we had a cross-reference map
          // But since we don't have a map, we just log it as unfixable
        }
      }
    }

    // 3. Validate env vars: `ENV_VAR`
    const envRegex = /`([A-Z][A-Z0-9_]{3,})`/g;
    while ((match = envRegex.exec(content)) !== null) {
      const envVar = match[1];
      if (["LICENSE", "VERSION", "NOTICE", "README", "CI"].includes(envVar))
        continue;

      if (!envs.has(envVar)) {
        issues.push({
          file: truthFile,
          reference: envVar,
          type: "env",
          message: `Environment variable referenced but missing from .env.example: ${envVar}`,
        });
      }
    }

    if (IS_FIX_MODE && content !== originalContent) {
      fs.writeFileSync(filePath, content);
    }
  }

  const report: TruthReport = {
    timestamp: new Date().toISOString(),
    issues,
  };

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const reportPath = path.join(ARTIFACTS_DIR, "truth.report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  if (fixesApplied > 0) {
    console.log(`Applied ${fixesApplied} truth fixes.`);
  }

  if (issues.length > 0) {
    console.warn(`Found ${issues.length} drift issues in repo truth files:`);
    issues.forEach((issue) => {
      console.log(
        `[${issue.type.toUpperCase()}] ${issue.file}: ${issue.message}`,
      );
    });
    process.exit(1);
  } else {
    console.log("No truth issues found!");
  }
}

validateTruth();
