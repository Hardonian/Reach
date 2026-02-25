#!/usr/bin/env node

import { spawn } from 'node:child_process';

const baseUrl = process.env.ROUTE_VERIFY_BASE_URL ?? 'http://127.0.0.1:3100';
const shouldStartServer = process.env.ROUTE_VERIFY_START === '1';
const serverStartupTimeoutMs = Number(process.env.ROUTE_VERIFY_TIMEOUT_MS ?? 60_000);

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status > 0) return;
    } catch {
      // keep polling
    }
    await sleep(1_000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function assertStatus(name, actual, expected) {
  if (!expected.includes(actual)) {
    throw new Error(`${name}: expected [${expected.join(', ')}], received ${actual}`);
  }
}

async function checkRoute(name, path, expectedStatuses) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
  assertStatus(name, response.status, expectedStatuses);
  console.log(`✅ ${name} -> ${response.status}`);
  return response;
}

async function checkStructuredError(name, path) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'follow' });
  if (response.status === 500) {
    throw new Error(`${name}: endpoint returned 500`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`${name}: expected JSON content-type, received "${contentType || 'none'}"`);
  }
  const payload = await response.json();
  if (typeof payload !== 'object' || payload === null) {
    throw new Error(`${name}: expected JSON object payload`);
  }
  if (!('error' in payload || 'ok' in payload || 'data' in payload)) {
    throw new Error(`${name}: payload missing structured response keys`);
  }
  console.log(`✅ ${name} -> ${response.status} structured JSON`);
}

let server;

try {
  if (shouldStartServer) {
    server = spawn('npm', ['--prefix', 'apps/arcade', 'run', 'start', '--', '--hostname', '127.0.0.1', '--port', '3100'], {
      stdio: 'inherit',
      env: process.env,
    });
    await waitForServer(baseUrl, serverStartupTimeoutMs);
  }

  await checkRoute('Homepage', '/', [200]);
  await checkRoute('Marketing roadmap', '/roadmap', [200, 308]);
  await checkRoute('Main app entry', '/dashboard', [200, 302, 307, 308, 401, 403]);

  await checkRoute('Governance DGL', '/governance/dgl', [200, 302, 307, 308, 401, 403]);
  await checkRoute('Governance CPX', '/governance/cpx', [200, 302, 307, 308, 401, 403]);
  await checkRoute('Governance SCCL', '/governance/sccl', [200, 302, 307, 308, 401, 403]);

  await checkStructuredError('API projects auth gate', '/api/v1/projects');
  await checkStructuredError('API gates auth gate', '/api/v1/gates');
  await checkStructuredError('API governance dgl', '/api/v1/governance/dgl');
} finally {
  if (server && !server.killed) {
    server.kill('SIGTERM');
  }
}
