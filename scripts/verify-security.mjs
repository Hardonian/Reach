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
  run(process.execPath, ["scripts/verify-lockfile.mjs"], "lockfile enforcement");
  run(process.execPath, ["scripts/secret-scan.mjs"], "secret scanning");
  run("npm", ["run", "verify:no-toxic-deps"], "blocked dependency enforcement");

  if (process.env.REACH_SKIP_NPM_AUDIT !== "1") {
    run("npm", ["audit", "--audit-level=high"], "npm high severity audit");
  } else {
    console.log("\n⚠ npm audit skipped (REACH_SKIP_NPM_AUDIT=1)");
  }

  console.log("\n✅ verify:security passed");
}

main();
