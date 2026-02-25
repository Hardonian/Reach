#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reach-conformance-"));
  const quickstart = spawnSync(
    process.execPath,
    [path.join("scripts", "quickstart-demo.mjs"), "--fixture-mode", "--output", tmpDir],
    { stdio: "inherit" },
  );
  if (quickstart.status !== 0) {
    throw new Error("quickstart demo generation failed");
  }

  const scclPath = path.join(tmpDir, "sccl-patch-pack.json");
  const runRecordPath = path.join(tmpDir, "run-record-bundle.json");
  const manifestPath = path.join(tmpDir, "artifact-manifest.json");
  const dglPath = path.join(tmpDir, "dgl-report.json");
  const cpxPath = path.join(tmpDir, "cpx-merge-plan.json");

  for (const requiredPath of [scclPath, runRecordPath, manifestPath, dglPath, cpxPath]) {
    assert(fs.existsSync(requiredPath), `missing artifact ${requiredPath}`);
  }

  const sccl = JSON.parse(fs.readFileSync(scclPath, "utf8"));
  assert(sccl.patch_pack?.id, "SCCL patch pack should include id");
  assert(sccl.patch_pack?.files?.length > 0, "SCCL patch pack should include files");

  const runRecord = JSON.parse(fs.readFileSync(runRecordPath, "utf8"));
  assert(Array.isArray(runRecord.artifacts), "run record should include artifacts");
  assert(runRecord.artifacts.length >= 3, "run record should include DGL/CPX/SCCL artifacts");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert(Array.isArray(manifest.files), "manifest should include files");
  for (const file of manifest.files) {
    const p = path.join(tmpDir, file.path);
    const content = fs.readFileSync(p, "utf8");
    assert(sha256(content) === file.sha256, `hash mismatch for ${file.path}`);
  }

  console.log("✅ patch pack and run record conformance passed");
}

main();
