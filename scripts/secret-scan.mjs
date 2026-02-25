#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const patterns = [
  { id: "aws-access-key", regex: /AKIA[0-9A-Z]{16}/g },
  { id: "github-pat", regex: /ghp_[A-Za-z0-9]{36,}/g },
  { id: "slack-token", regex: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { id: "private-key", regex: /-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/g },
  { id: "stripe-live", regex: /sk_live_[A-Za-z0-9]{10,}/g },
  { id: "google-api-key", regex: /AIza[0-9A-Za-z\-_]{35}/g },
];

const allowlistLine = /(example|placeholder|REDACTED|dummy|mock|test)/i;

function parseArgs() {
  const args = process.argv.slice(2);
  const sarifIdx = args.indexOf("--sarif");
  return {
    sarifPath: path.resolve(sarifIdx >= 0 ? args[sarifIdx + 1] : "dist/security/secrets.sarif"),
  };
}

function trackedFiles() {
  const output = execSync("git ls-files", { encoding: "utf8" }).trim();
  if (!output) return [];
  return output.split("\n");
}

function isLikelyBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  return sample.includes(0);
}

function scan() {
  const findings = [];
  for (const file of trackedFiles()) {
    if (!fs.existsSync(file)) continue;
    const contentBuffer = fs.readFileSync(file);
    if (isLikelyBinary(contentBuffer)) continue;
    const content = contentBuffer.toString("utf8");
    const lines = content.split(/\r?\n/);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      if (allowlistLine.test(line)) continue;
      for (const pattern of patterns) {
        pattern.regex.lastIndex = 0;
        const match = pattern.regex.exec(line);
        if (match) {
          findings.push({
            ruleId: pattern.id,
            file,
            line: lineNumber + 1,
            snippet: line.trim().slice(0, 160),
          });
        }
      }
    }
  }
  return findings;
}

function toSarif(findings) {
  return {
    version: "2.1.0",
    $schema: "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json",
    runs: [
      {
        tool: {
          driver: {
            name: "reach-secret-scan",
            informationUri: "https://github.com/reach/reach",
            rules: patterns.map((pattern) => ({
              id: pattern.id,
              name: pattern.id,
              shortDescription: { text: `Secret pattern detected: ${pattern.id}` },
              defaultConfiguration: { level: "error" },
            })),
          },
        },
        results: findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: "error",
          message: { text: `Potential secret detected (${finding.ruleId})` },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: finding.file },
                region: {
                  startLine: finding.line,
                  snippet: { text: finding.snippet },
                },
              },
            },
          ],
        })),
      },
    ],
  };
}

function main() {
  const { sarifPath } = parseArgs();
  const findings = scan();
  fs.mkdirSync(path.dirname(sarifPath), { recursive: true });
  fs.writeFileSync(sarifPath, `${JSON.stringify(toSarif(findings), null, 2)}\n`, "utf8");

  if (findings.length > 0) {
    console.error(`❌ secret scan detected ${findings.length} finding(s)`);
    for (const finding of findings.slice(0, 20)) {
      console.error(`  - ${finding.file}:${finding.line} [${finding.ruleId}]`);
    }
    process.exit(1);
  }

  console.log(`✅ secret scan passed (SARIF: ${sarifPath})`);
}

main();
