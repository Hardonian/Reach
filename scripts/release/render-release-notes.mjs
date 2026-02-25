#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs() {
  const args = process.argv.slice(2);
  const values = { version: "", output: "" };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--version") values.version = args[i + 1] ?? "";
    if (arg === "--output") values.output = args[i + 1] ?? "";
  }
  return values;
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function extractSection(changelog, heading) {
  const pattern = new RegExp(
    `## \\[${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`,
  );
  const match = changelog.match(pattern);
  return match ? match[1].trim() : "";
}

function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(__dirname, "..", "..");
  const changelogPath = path.join(root, "CHANGELOG.md");
  const versionPath = path.join(root, "VERSION");
  const args = parseArgs();
  const version = (args.version || readFile(versionPath)).trim().replace(/^v/, "");
  const outputPath = path.resolve(args.output || path.join(root, "dist", "RELEASE_NOTES.md"));
  const changelog = readFile(changelogPath);

  const versionSection = extractSection(changelog, version);
  const unreleasedSection = extractSection(changelog, "Unreleased");
  const body = versionSection || unreleasedSection;

  if (!body) {
    throw new Error(`No changelog section found for version ${version} or Unreleased.`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const rendered = `# Release v${version}\n\n${body}\n`;
  fs.writeFileSync(outputPath, rendered, "utf8");
  console.log(`Release notes written: ${outputPath}`);
}

main();
