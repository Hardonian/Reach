#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const enterpriseEnvVars = [
  'REACH_CLOUD',
  'REACH_ENTERPRISE',
  'STRIPE_SECRET_KEY',
  'AUTH0_DOMAIN',
  'AUTH0_CLIENT_ID',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS'
];

const env = { ...process.env, REACH_CLOUD: '0', REACH_ENTERPRISE: '0' };
for (const key of enterpriseEnvVars) {
  if (key in env) delete env[key];
}

const result = spawnSync('npm', ['run', 'verify:oss:core'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32'
});

process.exit(result.status ?? 1);
