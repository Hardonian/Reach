import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type Rule = {
  name: string;
  roots: string[];
  forbiddenPatterns: RegExp[];
  reason: string;
};

const ROOT = process.cwd();

const RULES: Rule[] = [
  {
    name: "core-must-not-depend-on-cli-or-integrations",
    roots: ["src/core", "packages/core", "core"],
    forbiddenPatterns: [
      /from\s+["'][^"']*(?:^|\/)(cli|display|integrations?|apps\/arcade|services\/billing)\//,
      /require\(["'][^"']*(?:^|\/)(cli|display|integrations?|apps\/arcade|services\/billing)\//,
    ],
    reason: "Core layer must stay runtime-agnostic and cannot import CLI/UI/integration code.",
  },
  {
    name: "library-must-not-import-cli",
    roots: ["src/lib"],
    forbiddenPatterns: [
      /from\s+["'][^"']*\/cli\//,
      /require\(["'][^"']*\/cli\//,
    ],
    reason: "Shared libraries cannot depend on CLI adapters.",
  },
  {
    name: "go-reachctl-must-not-import-web",
    roots: ["services/runner/cmd/reachctl"],
    forbiddenPatterns: [/"(?:[^"\n]*\/)?(?:apps\/arcade|next|react)(?:\/[^"\n]*)?"/],
    reason: "CLI Go entrypoint cannot import frontend frameworks.",
  },
];

function listFiles(root: string): string[] {
  const abs = path.join(ROOT, root);
  if (!fs.existsSync(abs)) return [];
  const cmd = `rg --files ${abs}`;
  const out = execSync(cmd, { encoding: "utf8" }).trim();
  if (!out) return [];
  return out
    .split("\n")
    .filter((file) => /\.(ts|tsx|js|mjs|cjs|go)$/.test(file));
}

function checkRule(rule: Rule): string[] {
  const violations: string[] = [];
  for (const root of rule.roots) {
    for (const file of listFiles(root)) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, idx) => {
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
        if (rule.forbiddenPatterns.some((pattern) => pattern.test(line))) {
          violations.push(`${file}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
  return violations;
}

function main(): void {
  let hasViolation = false;
  console.log("Validating import boundaries...");

  for (const rule of RULES) {
    const violations = checkRule(rule);
    if (violations.length === 0) continue;

    hasViolation = true;
    console.error(`\n[VIOLATION] ${rule.name}`);
    console.error(`Reason: ${rule.reason}`);
    for (const violation of violations) console.error(`  - ${violation}`);
  }

  if (hasViolation) {
    console.error("\nImport boundary validation failed.");
    process.exit(1);
  }

  console.log("✓ Import boundaries verified.");
}

main();
