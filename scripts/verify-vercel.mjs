#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const REQUIRED_DOC_KEYS = [
  "REACH_CLOUD_ENABLED",
  "CLOUD_DB_PATH",
  "REACH_SESSION_COOKIE_NAME",
  "REACH_SESSION_TTL_HOURS",
  "NEXT_PUBLIC_BASE_URL",
  "READYLAYER_BASE_URL",
];

function run(command, args, label, env = process.env) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.status !== 0) {
    throw new Error(`${label} failed`);
  }
}

function assertEnvDocumentation() {
  const content = fs.readFileSync(".env.example", "utf8");
  for (const key of REQUIRED_DOC_KEYS) {
    if (!content.match(new RegExp(`^#?\\s*${key}=`, "m"))) {
      throw new Error(`.env.example is missing ${key}`);
    }
  }
}

function main() {
  assertEnvDocumentation();
  run(process.execPath, ["scripts/verify-env.mjs"], "environment contract checks");

  const buildEnv = {
    ...process.env,
    NODE_ENV: "production",
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || "https://reach.dev",
    NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME || "ReadyLayer",
    READYLAYER_BASE_URL: process.env.READYLAYER_BASE_URL || "https://app.readylayer.com",
    REACH_CLOUD_ENABLED: process.env.REACH_CLOUD_ENABLED || "false",
  };
  delete buildEnv.STRIPE_SECRET_KEY;
  delete buildEnv.STRIPE_WEBHOOK_SECRET;
  delete buildEnv.GITHUB_CLIENT_SECRET;
  delete buildEnv.GITHUB_APP_PRIVATE_KEY;

  run("npm", ["run", "build", "--workspace", "arcade"], "next build (arcade)", buildEnv);
  run("npm", ["run", "build", "--workspace", "@reach/docs"], "next build (docs)", buildEnv);
  run(
    process.execPath,
    ["scripts/verify-routes.mjs"],
    "route smoke (marketing + governance + API)",
  );

  console.log("\n✅ verify:vercel passed");
}

main();
