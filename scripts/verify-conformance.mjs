#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function run(command, args, label) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error(`${label} failed`);
  }
}

function main() {
  run(process.execPath, ["tools/validate-spec.mjs"], "schema validations");
  run(process.execPath, ["compat/compat-suite.mjs"], "compatibility suite");
  run(
    process.execPath,
    ["--import", "tsx/esm", "scripts/verify-provider-conformance.mjs"],
    "provider adapter conformance",
  );
  run(process.execPath, ["scripts/verify-patch-pack.mjs"], "patch pack and run record validations");

  if (process.env.REACH_CONFORMANCE_SKIP_API !== "1") {
    run(
      process.execPath,
      ["scripts/verify-routes.mjs", "--api-only"],
      "API contract smoke harness",
    );
  } else {
    console.log("\n⚠ API contract smoke harness skipped (REACH_CONFORMANCE_SKIP_API=1)");
  }

  console.log("\n✅ verify:conformance passed");
}

main();
