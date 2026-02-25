#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const preferredPort = Number.parseInt(process.env.REACH_VERIFY_PORT ?? "3337", 10);
const minNodeMajor = 20;
const minNodeMinor = 9;
const node20FallbackVersion = "20.19.0";
const reexecGuardEnv = "REACH_VERIFY_ROUTES_REEXEC";
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

function isSupportedNodeVersion() {
  const [majorRaw, minorRaw] = process.versions.node.split(".");
  const major = Number.parseInt(majorRaw ?? "0", 10);
  const minor = Number.parseInt(minorRaw ?? "0", 10);
  return major > minNodeMajor || (major === minNodeMajor && minor >= minNodeMinor);
}

function ensureSupportedNodeVersion() {
  if (isSupportedNodeVersion()) return;
  const minimum = `${minNodeMajor}.${minNodeMinor}.0`;

  if (process.env[reexecGuardEnv] === "1") {
    console.error("❌ verify:routes failed");
    console.error(
      `Node ${process.versions.node} is unsupported for Next.js routing checks. Require >=${minimum}.`,
    );
    process.exit(1);
  }

  const scriptPath = fileURLToPath(import.meta.url);
  console.warn(
    `Node ${process.versions.node} is unsupported for verify:routes. Re-running with node@${node20FallbackVersion} via npx...`,
  );
  const rerun = spawnSync(
    "npx",
    ["-y", `node@${node20FallbackVersion}`, scriptPath, ...process.argv.slice(2)],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        [reexecGuardEnv]: "1",
      },
    },
  );
  process.exit(rerun.status ?? 1);
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

function startServer(port, appPath, mode = "start") {
  const command = mode === "dev" ? "dev" : "start";
  const child = spawn(process.execPath, [nextBin, command, "-p", String(port), "-H", host], {
    cwd: path.resolve(appPath),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: mode === "dev" ? "development" : "production",
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

function buildApp(appName, appPath) {
  console.log(`Building ${appName} for route checks...`);
  const build = spawnSync(process.execPath, [nextBin, "build"], {
    cwd: path.resolve(appPath),
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  if (build.stdout) process.stdout.write(build.stdout);
  if (build.stderr) process.stderr.write(build.stderr);
  if (build.status !== 0) {
    throw new Error(
      `${appName} build failed before route checks (exit code ${build.status ?? "unknown"}).`,
    );
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl, child, timeoutMs = 300_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js exited before readiness (exit code ${child.exitCode}).`);
    }
    if (/ready in|ready - started server|✓ Ready/i.test(bootLog)) {
      return;
    }
    const timeout = withTimeout(30_000);
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
    const timeout = withTimeout(90_000);
    let status = 599;
    let statusLabel = "599";
    const body = route.body ? JSON.stringify(route.body) : undefined;
    try {
      const response = await fetch(`${baseUrl}${route.path}`, {
        method: route.method ?? "GET",
        redirect: "manual",
        signal: timeout.signal,
        headers: route.headers ?? {},
        body,
      });
      const initialStatus = response.status;
      status = initialStatus;

      if ([301, 302, 307, 308].includes(initialStatus)) {
        const location = response.headers.get("location");
        if (location) {
          const followTimeout = withTimeout(90_000);
          try {
            const followResponse = await fetch(new URL(location, baseUrl).toString(), {
              method: route.method ?? "GET",
              redirect: "manual",
              signal: followTimeout.signal,
              headers: route.headers ?? {},
              body,
            });
            status = followResponse.status;
            statusLabel = `${initialStatus}->${status}`;
          } catch {
            status = initialStatus;
            statusLabel = String(initialStatus);
          } finally {
            followTimeout.clear();
          }
        } else {
          statusLabel = String(initialStatus);
        }
      } else {
        statusLabel = String(initialStatus);
      }
    } catch {
      status = 599;
      statusLabel = "599";
    } finally {
      timeout.clear();
    }

    const pass = route.allowedStatuses.includes(status);
    results.push({ route, status, statusLabel, pass });
  }

  console.log("Route verification results:");
  for (const result of results) {
    const label = result.pass ? "PASS" : "FAIL";
    console.log(
      `  ${label} ${result.route.method ?? "GET"} ${result.route.path} -> ${result.statusLabel} (expected ${result.route.allowedStatuses.join("/")})`,
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

async function checkApp(appName, appPath, routesToCheck, mode = "start") {
  console.log(`\nChecking routes for ${appName}...`);
  bootLog = "";
  if (mode === "start") {
    buildApp(appName, appPath);
  }
  const port = await findAvailablePort(preferredPort);
  const baseUrl = `http://${host}:${port}`;
  const child = startServer(port, appPath, mode);
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
  ensureSupportedNodeVersion();
  const selectedArcadeChecks = apiOnly
    ? arcadeRouteChecks.filter((route) => route.path.startsWith("/api/"))
    : arcadeRouteChecks;
  await checkApp("Arcade", "apps/arcade", selectedArcadeChecks, "start");
  if (!apiOnly) {
    await checkApp("Docs", "apps/docs", docsRouteChecks, "dev");
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
