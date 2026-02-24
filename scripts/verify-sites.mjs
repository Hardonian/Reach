#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  console.log("Running site split verification...");

  // Truth surfaces for marketing copy.
  run("node", ["--import", "tsx/esm", "tools/docs/drift/claims.ts"]);
  run("node", ["--import", "tsx/esm", "tools/docs/drift/links.ts"]);

  // Static architecture constraints.
  run("node", ["scripts/verify-boundaries.mjs"]);
  run("node", ["scripts/verify-canonical-urls.mjs"]);

  // Build OSS marketing/app site mode.
  run(
    "npm",
    ["run", "build", "--workspace", "arcade"],
    {
      ...process.env,
      NEXT_PUBLIC_BASE_URL: "https://reach.dev",
      NEXT_PUBLIC_BRAND_NAME: "ReadyLayer",
      REACH_CLOUD_ENABLED: "false",
    },
  );

  // Build docs site mode.
  run(
    "npm",
    ["run", "build", "--workspace", "@reach/docs"],
    {
      ...process.env,
      NEXT_PUBLIC_DOCS_BASE_URL: "https://reach-cli.com",
    },
  );

  // Build enterprise stub mode (no enterprise secrets required).
  run(
    "npm",
    ["run", "build", "--workspace", "arcade"],
    {
      ...process.env,
      NEXT_PUBLIC_BASE_URL: "https://app.reach.dev",
      NEXT_PUBLIC_BRAND_NAME: "ReadyLayer",
      REACH_CLOUD_ENABLED: "true",
    },
  );

  console.log("✅ verify:sites passed");
}

main();

