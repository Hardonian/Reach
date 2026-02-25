#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const host = "127.0.0.1";
const preferredPort = Number.parseInt(process.env.REACH_VERIFY_PORT ?? "3337", 10);
const minNodeMajor = 20;
const minNodeMinor = 9;
const apiOnly = process.argv.includes("--api-only");

const nextBinCandidates = [
  path.resolve("apps/arcade/node_modules/next/dist/bin/next"),
  path.resolve("node_modules/next/dist/bin/next"),
];
const nextBin = nextBinCandidates.find((candidate) => existsSync(candidate));

if (!nextBin) {
  console.error("❌ verify:routes failed");
  console.error("Could not locate Next.js binary in app or repo node_modules.");
  process.exit(1);
}

let bootLog = "";

function assertNodeVersion() {
  const [majorRaw, minorRaw] = process.versions.node.split(".");
  const major = Number.parseInt(majorRaw ?? "0", 10);
  const minor = Number.parseInt(minorRaw ?? "0", 10);
  const supported = major > minNodeMajor || (major === minNodeMajor && minor >= minNodeMinor);

  if (supported) return;
  console.error("❌ verify:routes failed");
  console.error(
    `Node ${process.versions.node} is unsupported for Next.js routing checks. Require >=${minNodeMajor}.${minNodeMinor}.0.`,
  );
  process.exit(1);
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

function reservePort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => reject(error));
    server.listen(port, host, () => {
      const address = server.address();
      const selectedPort =
        address && typeof address === "object" ? address.port : Number.parseInt(String(port), 10);
      server.close((closeErr) => {
        if (closeErr) return reject(closeErr);
        resolve(selectedPort);
      });
    });
  });
}

async function findAvailablePort(port) {
  try {
    return await reservePort(port);
  } catch {
    return reservePort(0);
  }
}

function startServer(port, appPath) {
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port), "-H", host], {
    cwd: path.resolve(appPath),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "test",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });

  child.stdout.on("data", (chunk) => {
    bootLog += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    bootLog += chunk.toString();
  });
  return child;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl, child, timeoutMs = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js exited before readiness (exit code ${child.exitCode}).`);
    }
    const timeout = withTimeout(5000);
    try {
      const response = await fetch(baseUrl, { redirect: "manual", signal: timeout.signal });
      if (response.status > 0) return;
    } catch {
      // keep polling
    } finally {
      timeout.clear();
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for server at ${baseUrl}`);
}

async function stopServer(child) {
  if (!child) return;
  child.kill("SIGTERM");
  await sleep(750);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await sleep(250);
  }
}

async function runChecks(baseUrl, routesToCheck) {
  const results = [];
  for (const route of routesToCheck) {
    const timeout = withTimeout(20_000);
    let status;
    try {
      const response = await fetch(`${baseUrl}${route.path}`, {
        method: route.method ?? "GET",
        redirect: "manual",
        signal: timeout.signal,
        headers: route.headers ?? {},
        body: route.body ? JSON.stringify(route.body) : undefined,
      });
      status = response.status;
    } catch {
      status = 599;
    } finally {
      timeout.clear();
    }

    const pass = route.allowedStatuses.includes(status);
    results.push({ route, status, pass });
  }

  console.log("Route verification results:");
  for (const result of results) {
    const label = result.pass ? "PASS" : "FAIL";
    console.log(
      `  ${label} ${result.route.method ?? "GET"} ${result.route.path} -> ${result.status} (expected ${result.route.allowedStatuses.join("/")})`,
    );
  }

  const failed = results.filter((result) => !result.pass);
  if (failed.length > 0) {
    throw new Error(
      `verification failed (${failed.length} route(s) returned unexpected status): ${failed
        .map((item) => `${item.route.path}:${item.status}`)
        .join(", ")}`,
    );
  }
}

async function checkApp(appName, appPath, routesToCheck) {
  console.log(`\nChecking routes for ${appName}...`);
  const port = await findAvailablePort(preferredPort);
  const baseUrl = `http://${host}:${port}`;
  const child = startServer(port, appPath);
  try {
    await waitForServer(baseUrl, child);
    await runChecks(baseUrl, routesToCheck);
    console.log(`✅ ${appName} routes passed`);
  } finally {
    await stopServer(child);
  }
}

const arcadeRouteChecks = [
  { path: "/", allowedStatuses: [200] },
  { path: "/pricing", allowedStatuses: [200] },
  { path: "/docs", allowedStatuses: [200] },
  { path: "/governance", allowedStatuses: [200] },
  { path: "/support", allowedStatuses: [200] },
  { path: "/faq", allowedStatuses: [200] },
  { path: "/console/governance", allowedStatuses: [200, 302, 307] },
  { path: "/console/artifacts", allowedStatuses: [200, 302, 307] },
  { path: "/api/health", allowedStatuses: [200] },
  { path: "/api/ready", allowedStatuses: [200, 503] },
  { path: "/api/v1/dgl", allowedStatuses: [200, 401, 403] },
  { path: "/api/v1/cpx", allowedStatuses: [200, 401, 403] },
  { path: "/api/v1/sccl", allowedStatuses: [200, 401, 403] },
  { path: "/api/v1/policy", allowedStatuses: [200, 401, 403] },
  { path: "/api/v1/gates", allowedStatuses: [200, 401, 403] },
  { path: "/api/v1/governance/history", allowedStatuses: [200, 401, 403] },
  { path: "/api/v1/governance/memory", allowedStatuses: [200, 401, 403] },
  { path: "/api/v1/governance/artifacts/demo", allowedStatuses: [401, 403, 404] },
  { path: "/api/v1/scenarios", allowedStatuses: [200, 401, 403] },
  { path: "/api/v1/signals", allowedStatuses: [200, 401, 403] },
  { path: "/api/v1/workflows", allowedStatuses: [200, 401, 403] },
  {
    method: "POST",
    path: "/api/v1/governance/assistant",
    allowedStatuses: [400, 401, 403],
    headers: { "content-type": "application/json" },
    body: {},
  },
];

const docsRouteChecks = [
  { path: "/", allowedStatuses: [200] },
  { path: "/docs/install", allowedStatuses: [200] },
  { path: "/docs/quickstart", allowedStatuses: [200] },
  { path: "/docs/cli", allowedStatuses: [200] },
  { path: "/docs/config", allowedStatuses: [200] },
  { path: "/docs/faq", allowedStatuses: [200] },
  { path: "/support", allowedStatuses: [200] },
];

async function main() {
  assertNodeVersion();
  await checkApp("Arcade", "apps/arcade", arcadeRouteChecks);
  if (!apiOnly) {
    await checkApp("Docs", "apps/docs", docsRouteChecks);
  }
  console.log("\n✅ All project routes verified");
}

main().catch((error) => {
  console.error("❌ verify:routes failed");
  console.error(String(error));
  if (bootLog.trim().length > 0) {
    console.error("--- server log ---");
    console.error(bootLog.slice(-6000));
  }
  process.exit(1);
});
