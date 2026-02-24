#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const host = "127.0.0.1";
const preferredPort = Number.parseInt(process.env.REACH_VERIFY_PORT ?? "3337", 10);

const routes = ["/", "/docs", "/app"];

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
        if (closeErr) {
          reject(closeErr);
          return;
        }
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

function startServer(port) {
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port), "-H", host], {
    cwd: path.resolve("apps/arcade"),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "test",
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

async function waitForServer(baseUrl, timeoutMs = 120_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      // Keep polling until timeout.
    }
    await sleep(1000);
  }

  throw new Error(`Timed out waiting for server at ${baseUrl}`);
}

async function runChecks(baseUrl) {
  const results = [];

  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
    const pass = response.status < 500;
    results.push({ route, status: response.status, pass });
  }

  const failed = results.filter((result) => !result.pass);

  console.log("Route verification results:");
  for (const result of results) {
    const label = result.pass ? "PASS" : "FAIL";
    console.log(`  ${label} ${result.route} -> ${result.status}`);
  }

  if (failed.length > 0) {
    throw new Error(
      `verify:routes failed (${failed.length} route(s) returned 500+): ${failed
        .map((item) => `${item.route}:${item.status}`)
        .join(", ")}`,
    );
  }
}

async function main() {
  let child;
  try {
    const port = await findAvailablePort(preferredPort);
    const baseUrl = `http://${host}:${port}`;
    child = startServer(port);
    await waitForServer(baseUrl);
    await runChecks(baseUrl);
    console.log("✅ verify:routes passed");
  } finally {
    if (child) {
      child.kill("SIGTERM");
      await sleep(500);
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
  }
}

main().catch((error) => {
  console.error("❌ verify:routes failed");
  console.error(String(error));
  if (bootLog.trim().length > 0) {
    console.error("--- server log ---");
    console.error(bootLog.slice(-4000));
  }
  process.exit(1);
});
