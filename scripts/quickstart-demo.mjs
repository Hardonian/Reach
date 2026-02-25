#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function writeJson(filePath, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(filePath, content, "utf8");
  return { filePath, hash: sha256(content) };
}

function main() {
  const args = process.argv.slice(2);
  const runIdArgIndex = args.indexOf("--run-id");
  const runId = runIdArgIndex >= 0 ? args[runIdArgIndex + 1] : "fixture-run-0001";
  const fixtureMode = args.includes("--fixture-mode");
  const outputDirArgIndex = args.indexOf("--output");
  const outputDir =
    outputDirArgIndex >= 0
      ? path.resolve(args[outputDirArgIndex + 1])
      : path.resolve("dist", "demo");

  fs.mkdirSync(outputDir, { recursive: true });

  const generatedAt = process.env.REACH_QUICKSTART_TIMESTAMP || "2026-02-25T00:00:00Z";
  const mode = fixtureMode ? "fixture" : "live";

  const dgl = writeJson(path.join(outputDir, "dgl-report.json"), {
    mode,
    run_id: runId,
    verdict: "passed",
    primary_reason: "All required checks passed",
    related_signals: ["policy.hash.match", "artifact.manifest.present", "replay.verifiable"],
    generated_at: generatedAt,
  });

  const cpx = writeJson(path.join(outputDir, "cpx-merge-plan.json"), {
    mode,
    run_id: runId,
    candidates: ["pack-alpha", "pack-beta"],
    decision: "pack-alpha",
    confidence: 0.92,
    merge_plan: ["apply sccl patch pack", "run gate checks", "open PR"],
    generated_at: generatedAt,
  });

  const sccl = writeJson(path.join(outputDir, "sccl-patch-pack.json"), {
    mode,
    run_id: runId,
    patch_pack: {
      id: "ppack-fixture-001",
      base_ref: "main",
      target_ref: "reach/quickstart",
      files: [{ path: "README.md", action: "update" }],
    },
    generated_at: generatedAt,
  });

  const runRecord = writeJson(path.join(outputDir, "run-record-bundle.json"), {
    mode,
    run_id: runId,
    artifacts: [
      { type: "dgl", path: "dgl-report.json", hash: dgl.hash },
      { type: "cpx", path: "cpx-merge-plan.json", hash: cpx.hash },
      { type: "sccl", path: "sccl-patch-pack.json", hash: sccl.hash },
    ],
    generated_at: generatedAt,
  });

  const manifest = writeJson(path.join(outputDir, "artifact-manifest.json"), {
    mode,
    run_id: runId,
    generated_at: generatedAt,
    files: [
      { path: path.basename(dgl.filePath), sha256: dgl.hash },
      { path: path.basename(cpx.filePath), sha256: cpx.hash },
      { path: path.basename(sccl.filePath), sha256: sccl.hash },
      { path: path.basename(runRecord.filePath), sha256: runRecord.hash },
    ],
  });

  fs.writeFileSync(
    path.join(outputDir, "next-actions.txt"),
    [
      "1) Apply SCCL patch pack and commit to a feature branch.",
      "2) Open a PR and verify ReadyLayer checks are green.",
      "3) Run CPX arbitration if multiple candidate packs exist.",
      "4) Execute: npm run verify:conformance",
    ].join("\n"),
    "utf8",
  );

  console.log(`Quickstart demo complete (${mode} mode)`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Run ID: ${runId}`);
  console.log(`DGL: ${path.join(outputDir, "dgl-report.json")}`);
  console.log(`CPX: ${path.join(outputDir, "cpx-merge-plan.json")}`);
  console.log(`SCCL: ${path.join(outputDir, "sccl-patch-pack.json")}`);
  console.log(`Run record: ${path.join(outputDir, "run-record-bundle.json")}`);
  console.log(`Manifest: ${manifest.filePath}`);
}

main();
