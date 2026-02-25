#!/usr/bin/env npx tsx
import fs from 'fs';
import path from 'path';
import { cpxToMarkdown, cpxToSarif, runCpx, type PatchPack } from '../src/dgl/cpx.js';

const root = process.cwd();
const outDir = path.join(root, 'dgl', 'cpx', 'examples');
fs.mkdirSync(outDir, { recursive: true });

const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, 'dgl', 'cpx', 'fixtures', f), 'utf-8')) as PatchPack;
const scenarios: Record<string, [string, string]> = {
  s1: ['s1-pack-a.json', 's1-pack-b.json'],
  s2: ['s2-pack-a.json', 's2-pack-b.json'],
  s3: ['s3-pack-a.json', 's3-pack-b.json'],
};

for (const [id, [a, b]] of Object.entries(scenarios)) {
  const report = runCpx([read(a), read(b)], root);
  const jsonPath = path.join(outDir, `${id}-${report.run_id}.json`);
  const mdPath = path.join(outDir, `${id}-${report.run_id}.md`);
  const sarifPath = path.join(outDir, `${id}-${report.run_id}.sarif`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, cpxToMarkdown(report));
  fs.writeFileSync(sarifPath, JSON.stringify(cpxToSarif(report), null, 2));
  console.log(`${id}: ${report.arbitration.decision_type} -> ${jsonPath}`);
}
