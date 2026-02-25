#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function probe(url) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: null };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const dataDir = process.env.REACH_DATA_DIR?.trim() || path.join(process.cwd(), "data");
  const obsPath = path.join(dataDir, "observability.json");
  const obs = readJson(obsPath, null);
  const baseUrl = process.env.REACH_STATUS_BASE_URL || "http://127.0.0.1:3000";
  const [health, ready] = await Promise.all([
    probe(`${baseUrl}/api/health`),
    probe(`${baseUrl}/api/ready`),
  ]);

  const snapshot = {
    checked_at: new Date().toISOString(),
    base_url: baseUrl,
    routes: {
      health,
      ready,
    },
    observability: obs ?? {
      counters: {},
      lastReconciliationRunAt: null,
      updatedAt: null,
      status: "not_found",
    },
  };

  if (asJson) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log("Reach Status");
  console.log(`Base URL: ${snapshot.base_url}`);
  console.log(`Health: ${health.status ?? "unreachable"}`);
  console.log(`Ready: ${ready.status ?? "unreachable"}`);
  console.log(
    `Last reconciliation run: ${snapshot.observability.lastReconciliationRunAt ?? "not recorded"}`,
  );
  console.log("Counters:");
  const counters = snapshot.observability.counters || {};
  for (const key of Object.keys(counters).sort()) {
    console.log(`  - ${key}: ${counters[key]}`);
  }
}

main();
