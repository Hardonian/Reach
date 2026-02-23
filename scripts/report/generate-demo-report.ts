#!/usr/bin/env tsx
/**
 * Demo Report Generator
 *
 * Generates a deterministic, shareable artifact for bug reports and feedback.
 * Contains no secrets, only version hashes and environment metadata.
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { createHash } from "crypto";

interface EnvironmentSnapshot {
  node: string;
  npm: string;
  platform: string;
  arch: string;
  versions: Record<string, string>;
}

interface DemoReport {
  generatedAt: string;
  reachVersion: string;
  environment: EnvironmentSnapshot;
  manifest: {
    reportId: string;
    schemaVersion: string;
    integrityHash: string;
  };
}

function getVersions(): Record<string, string> {
  const versions: Record<string, string> = {};

  try {
    versions.node = process.version;
  } catch {
    /* ignore */
  }

  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    versions.reach = pkg.version || "unknown";
  } catch {
    /* ignore */
  }

  try {
    versions.go = execSync("go version", { encoding: "utf8" }).trim().split(" ")[2];
  } catch {
    versions.go = "not found";
  }

  try {
    versions.rust = execSync("rustc --version", { encoding: "utf8" }).trim().split(" ")[1];
  } catch {
    versions.rust = "not found";
  }

  return versions;
}

function generateReportId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `demo-${timestamp}-${random}`;
}

function computeIntegrityHash(data: unknown): string {
  const str = JSON.stringify(data, Object.keys(data as object).sort());
  return createHash("sha256").update(str).digest("hex").substring(0, 32);
}

function generateEnvironmentSnapshot(): EnvironmentSnapshot {
  return {
    node: process.version,
    npm: "unknown", // Could be expanded
    platform: process.platform,
    arch: process.arch,
    versions: getVersions(),
  };
}

function generateTimeline(): unknown[] {
  const timeline: unknown[] = [];
  const examplesDir = "examples";

  if (existsSync(examplesDir)) {
    const examples = readdirSync(examplesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.match(/^\d+-/))
      .map((d) => d.name)
      .sort();

    for (const example of examples) {
      timeline.push({
        type: "example",
        name: example,
        status: "available",
        command: `node examples/${example}/run.js`,
      });
    }
  }

  return timeline;
}

function generateOutputs(): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};

  // Run example 01 and capture output (safe, deterministic)
  try {
    const example01Output = execSync("node examples/01-quickstart-local/run.js 2>&1", {
      encoding: "utf8",
      timeout: 30000,
    });
    outputs["example-01"] = {
      command: "node examples/01-quickstart-local/run.js",
      output: example01Output,
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    outputs["example-01"] = {
      error: "Failed to run example-01",
      details: String(e),
    };
  }

  return outputs;
}

function main(): void {
  const args = process.argv.slice(2);
  const outputDir = args[0] || "demo-report";
  const resolvedDir = resolve(outputDir);

  console.log(`Generating demo report in: ${resolvedDir}`);

  // Create output directory
  mkdirSync(resolvedDir, { recursive: true });
  mkdirSync(join(resolvedDir, "outputs"), { recursive: true });

  // Generate report data
  const reportId = generateReportId();
  const env = generateEnvironmentSnapshot();
  const timeline = generateTimeline();
  const outputs = generateOutputs();

  const report: DemoReport = {
    generatedAt: new Date().toISOString(),
    reachVersion: env.versions.reach || "unknown",
    environment: env,
    manifest: {
      reportId,
      schemaVersion: "1.0.0",
      integrityHash: "", // computed below
    },
  };

  // Compute integrity hash
  report.manifest.integrityHash = computeIntegrityHash({
    ...report,
    timeline,
    outputs,
  });

  // Write manifest.json
  writeFileSync(join(resolvedDir, "manifest.json"), JSON.stringify(report, null, 2));

  // Write timeline.json
  writeFileSync(join(resolvedDir, "timeline.json"), JSON.stringify(timeline, null, 2));

  // Write env.json
  writeFileSync(join(resolvedDir, "env.json"), JSON.stringify(env, null, 2));

  // Write outputs
  for (const [key, value] of Object.entries(outputs)) {
    writeFileSync(join(resolvedDir, "outputs", `${key}.json`), JSON.stringify(value, null, 2));
  }

  // Write index.md (human readable)
  const indexMd = `# Demo Report

**Report ID:** ${reportId}  
**Generated:** ${report.generatedAt}  
**Reach Version:** ${report.reachVersion}

## Environment

| Property | Value |
|----------|-------|
| Node.js | ${env.node} |
| Platform | ${env.platform} |
| Architecture | ${env.arch} |
| Go | ${env.versions.go} |
| Rust | ${env.versions.rust} |

## Integrity

**Hash:** \`${report.manifest.integrityHash}\`

## Available Examples

${timeline
  .filter((t) => (t as { type: string }).type === "example")
  .map((t) => {
    const ex = t as { name: string; command: string };
    return `- **${ex.name}**: \`\`\`bash\n${ex.command}\n\`\`\``;
  })
  .join("\n")}

## Files

- \`manifest.json\` - Report metadata and integrity hash
- \`timeline.json\` - Ordered events and available examples
- \`env.json\` - Environment snapshot (versions only, no secrets)
- \`outputs/\` - Key outputs from demo run

## Verification

To verify this report:

\`\`\`bash
./reach report verify ${resolvedDir}
\`\`\`
`;

  writeFileSync(join(resolvedDir, "index.md"), indexMd);

  console.log("✓ Demo report generated successfully");
  console.log(`  Location: ${resolvedDir}/`);
  console.log(`  Report ID: ${reportId}`);
  console.log(`  Integrity: ${report.manifest.integrityHash}`);
  console.log("");
  console.log("To verify:");
  console.log(`  ./reach report verify ${resolvedDir}`);
}

main();
