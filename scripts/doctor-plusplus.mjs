#!/usr/bin/env node
/**
 * doctor-plusplus.mjs
 * Extended reliability checks with retries, backoff, and explicit degraded states.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const MAX_RETRIES = Number(process.env.REACH_DOCTOR_RETRIES || 3);
const BASE_DELAY_MS = Number(process.env.REACH_DOCTOR_BACKOFF_MS || 700);

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...opts,
  });
}

function retryCheck(name, fn) {
  const attempts = [];
  for (let i = 1; i <= MAX_RETRIES; i++) {
    const res = fn();
    attempts.push(res);
    if (res.ok) return { name, ok: true, degraded: i > 1, attempts, final: res };
    if (i < MAX_RETRIES) sleep(BASE_DELAY_MS * 2 ** (i - 1));
  }
  const final = attempts[attempts.length - 1];
  return { name, ok: false, degraded: Boolean(final?.degraded), attempts, final };
}

function checkNode() {
  const res = run('node', ['-v']);
  return {
    ok: res.status === 0,
    detail: (res.stdout || res.stderr || '').trim(),
  };
}

function checkPnpm() {
  const res = run('pnpm', ['-v']);
  return {
    ok: res.status === 0,
    detail: (res.stdout || res.stderr || '').trim(),
  };
}

function checkPackageLockHealth() {
  const hasPnpmLock = fs.existsSync('pnpm-lock.yaml');
  const hasPkg = fs.existsSync('package.json');
  return {
    ok: hasPkg && hasPnpmLock,
    detail: `package.json=${hasPkg} pnpm-lock.yaml=${hasPnpmLock}`,
  };
}

function checkReachDaemon() {
  // Explicit degraded state: daemon may be intentionally offline during local dev.
  const res = run('node', ['scripts/reach-health.mjs']);
  const output = (res.stdout || res.stderr || '').trim();
  if (res.status === 0) {
    return { ok: true, detail: output.split('\n').slice(-3).join(' | ') };
  }
  return {
    ok: false,
    degraded: true,
    detail: `daemon-unreachable: ${output.split('\n').slice(-2).join(' | ')}`,
  };
}

function main() {
  const checks = [
    retryCheck('node-runtime', checkNode),
    retryCheck('pnpm-runtime', checkPnpm),
    retryCheck('workspace-lock-health', checkPackageLockHealth),
    retryCheck('reach-daemon-health', checkReachDaemon),
  ];

  const hardFailed = checks.filter((c) => !c.ok && !c.degraded);
  const degraded = checks.filter((c) => c.degraded || (!c.ok && c.degraded));

  const report = {
    timestamp: new Date().toISOString(),
    retries: MAX_RETRIES,
    backoffMs: BASE_DELAY_MS,
    status: hardFailed.length ? 'critical' : degraded.length ? 'degraded' : 'healthy',
    checks: checks.map((c) => ({
      name: c.name,
      ok: c.ok,
      degraded: c.degraded,
      attempts: c.attempts.length,
      detail: c.final?.detail || '',
    })),
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(hardFailed.length ? 1 : 0);
}

main();
