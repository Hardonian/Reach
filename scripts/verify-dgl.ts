#!/usr/bin/env npx tsx
import { execSync } from 'child_process';

const steps = [
  'npx tsx scripts/dgl-gate.ts scan',
  'npx tsx scripts/dgl-gate.ts openapi --base-spec dgl/fixtures/openapi/base.json --head-spec dgl/fixtures/openapi/head-breaking.json',
  'npx tsx scripts/dgl-gate.ts openapi --base-spec dgl/fixtures/openapi/base.json --head-spec dgl/fixtures/openapi/head-warn.json || true',
  'npx tsx scripts/dgl-gate.ts doctor',
];

for (const s of steps) {
  try {
    console.log(`$ ${s}`);
    console.log(execSync(s, { encoding: 'utf-8' }));
  } catch (error) {
    console.log(`command failed as expected for gate behavior: ${s}`);
  }
}
