#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const minNodeMajor = 20;
const minNodeMinor = 9;
const defaultPort = Number.parseInt(process.env.REACH_SMOKE_PORT ?? "3340", 10);
const host = "127.0.0.1";
const reexecEnv = "REACH_SMOKE_ROUTES_REEXEC";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const bundledNodePath = path.join(
  repoRoot,
  ".artifacts",
  "tools",
  "node-v20.20.0-linux-x64",
  "bin",
  "node",
);

const nextBinCandidates = [
  path.resolve(repoRoot, "apps/arcade/node_modules/next/dist/bin/next"),
  path.resolve(repoRoot, "node_modules/next/dist/bin/next"),
];
const nextBin = nextBinCandidates.find((candidate) => existsSync(candidate));

if (!nextBin) {
  console.error("Could not find Next.js binary. Run npm run deps:repair first.");
  process.exit(1);
}

function parseNodeVersion(version) {
  const [majorRaw = "0", minorRaw = "0"] = version.split(".");
  return {
    major: Number.parseInt(majorRaw, 10),
    minor: Number.parseInt(minorRaw, 10),
  };
}

function isSupportedNode(version = process.versions.node) {
  const { major, minor } = parseNodeVersion(version);
  return major > minNodeMajor || (major === minNodeMajor && minor >= minNodeMinor);
}

function ensureSupportedNodeVersion() {
  if (isSupportedNode()) return;
  if (process.env[reexecEnv] === "1") {
    console.error(
      `Node ${process.versions.node} is unsupported for smoke:routes:auto. Require >=${minNodeMajor}.${minNodeMinor}.0`,
    );
    process.exit(1);
  }
  if (!existsSync(bundledNodePath)) {
    console.error(
      `Node ${process.versions.node} is unsupported and bundled Node 20 was not found at ${bundledNodePath}.`,
    );
    process.exit(1);
  }
  const scriptPath = fileURLToPath(import.meta.url);
  const rerun = spawnSync(bundledNodePath, [scriptPath], {
    stdio: "inherit",
    env: {
      ...process.env,
      [reexecEnv]: "1",
    },
  });
  process.exit(rerun.status ?? 1);
}

function reservePort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
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

async function findAvailablePort() {
  try {
    return await reservePort(defaultPort);
  } catch {
    return reservePort(0);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl, child, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(baseUrl, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // keep polling
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function stopServer(child) {
  if (!child) return;
  child.kill("SIGTERM");
  await sleep(750);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

ensureSupportedNodeVersion();

console.log("Building Arcade app for smoke tests...");
const build = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: path.resolve(repoRoot, "apps/arcade"),
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: "production",
  },
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const port = await findAvailablePort();
const baseUrl = `http://${host}:${port}`;
console.log(`Starting Arcade server at ${baseUrl} ...`);
const server = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", host], {
  cwd: path.resolve(repoRoot, "apps/arcade"),
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: "production",
  },
});
server.stdout.on("data", (chunk) => process.stdout.write(chunk.toString()));
server.stderr.on("data", (chunk) => process.stderr.write(chunk.toString()));

let exitCode = 1;
try {
  await waitForServer(baseUrl, server);
  console.log("Running route smoke tests...");
  const smoke = spawnSync(
    process.execPath,
    [path.resolve(repoRoot, "tests/smoke/routes.test.mjs")],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        BASE_URL: baseUrl,
      },
    },
  );
  exitCode = smoke.status ?? 1;
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  exitCode = 1;
} finally {
  await stopServer(server);
}

process.exit(exitCode);
