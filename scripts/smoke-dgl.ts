#!/usr/bin/env npx tsx
import { execSync } from 'child_process';
import fs from 'fs';

fs.mkdirSync('dgl/examples/generated', { recursive: true });
const out = execSync('npx tsx scripts/dgl-gate.ts scan', { encoding: 'utf-8' });
fs.writeFileSync('dgl/examples/generated/smoke-output.json', out);
execSync('npx tsx scripts/dgl-gate.ts openapi --base-spec dgl/fixtures/openapi/base.json --head-spec dgl/fixtures/openapi/head-breaking.json || true', { encoding: 'utf-8' });
console.log('smoke complete');
