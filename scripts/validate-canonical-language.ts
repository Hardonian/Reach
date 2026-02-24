#!/usr/bin/env npx tsx
import fs from "fs";
import path from "path";

interface CanonicalConfig {
  public_terms: Record<string, string>;
  banned_terms: string[];
  allowed_paths: string[];
  forbidden_paths: string[];
}

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, "config/canonical-language.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as CanonicalConfig;
const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".md"]);

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (full.includes("node_modules") || full.includes(".next") || full.includes("dist")) continue;
    if (ent.isDirectory()) walk(full, out);
    else if (exts.has(path.extname(ent.name))) out.push(full);
  }
}

const files: string[] = [];
for (const p of config.forbidden_paths) walk(path.join(repoRoot, p), files);
const violations: string[] = [];

for (const file of files) {
  const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
  if (config.allowed_paths.some((allow) => rel.startsWith(allow))) continue;
  const lines = fs.readFileSync(file, "utf-8").split("\n");
  lines.forEach((line, i) => {
    for (const term of config.banned_terms) {
      if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(line)) {
        const replacement = config.public_terms[term] ?? "approved public term";
        violations.push(`${rel}:${i + 1} banned term '${term}' -> '${replacement}'`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`validate:language — FAILED (${violations.length})`);
  violations.forEach((v) => console.error(`  ${v}`));
  process.exit(1);
}

console.log("validate:language — PASSED (0 terminology violations)");
