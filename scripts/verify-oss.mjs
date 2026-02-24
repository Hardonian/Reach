#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const enterpriseLikeKeys = [
  "REACH_CLOUD_ENABLED",
  "REACH_CLOUD",
  "BILLING_ENABLED",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

function makeOssEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (enterpriseLikeKeys.includes(key) || key.startsWith("REACH_ENTERPRISE_")) {
      delete env[key];
    }
  }
  return env;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: makeOssEnv(),
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  console.log("Running verify:oss with enterprise env unset...");
  run("node", ["scripts/validate-oss-purity.mjs"]);
  run("node", ["scripts/verify-boundaries.mjs"]);
  console.log("✅ verify:oss passed");
}

main();
