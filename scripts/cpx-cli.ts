#!/usr/bin/env npx tsx
import fs from 'fs';
import path from 'path';
import { cpxToMarkdown, cpxToSarif, createPackFromGit, runCpx, validatePatchPack, type PatchPack, type TaskClass } from '../src/dgl/cpx.js';

const args = process.argv.slice(2);
const cmd = args[0] ?? 'help';
const flag = (name: string, fallback = '') => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : fallback;
};

function readPack(p: string): PatchPack {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), p), 'utf-8')) as PatchPack;
}

if (cmd === 'pack') {
  const from = flag('--from', 'HEAD~1');
  const to = flag('--to', 'HEAD');
  const out = flag('--out', path.join('dgl', 'cpx', 'patch-pack.json'));
  const provider = flag('--provider', 'local');
  const model = flag('--model', 'default');
  const agentId = flag('--agent-id', 'reach-cpx');
  const taskClass = (flag('--task-class', 'bugfix') as TaskClass);
  const pack = createPackFromGit(from, to, provider, model, agentId, taskClass);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(pack, null, 2));
  console.log(JSON.stringify({ ok: true, output: out }, null, 2));
  process.exit(0);
}

if (cmd === 'validate-pack') {
  const file = args[1] || flag('--file', '');
  if (!file) throw new Error('Missing pack path');
  const result = validatePatchPack(readPack(file));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (cmd === 'run') {
  const packsArg = flag('--packs', '');
  const outDir = flag('--out-dir', path.join('dgl', 'cpx', 'reports'));
  if (!packsArg) throw new Error('Missing --packs <comma-separated paths>');
  const packs = packsArg.split(',').map((p) => readPack(p.trim()));
  const report = runCpx(packs, process.cwd());
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, `${report.run_id}.json`);
  const mdPath = path.join(outDir, `${report.run_id}.md`);
  const sarifPath = path.join(outDir, `${report.run_id}.sarif`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, cpxToMarkdown(report));
  fs.writeFileSync(sarifPath, JSON.stringify(cpxToSarif(report), null, 2));
  console.log(JSON.stringify({ ok: true, report: reportPath, markdown: mdPath, sarif: sarifPath, decision: report.arbitration.decision_type }, null, 2));
  process.exit(0);
}

if (cmd === 'report') {
  const id = flag('--id', '');
  const reportPath = id ? path.join('dgl', 'cpx', 'reports', `${id}.json`) : flag('--path', '');
  if (!reportPath || !fs.existsSync(reportPath)) throw new Error('Report file not found.');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as ReturnType<typeof runCpx>;
  console.log(cpxToMarkdown(report));
  process.exit(0);
}

console.log('Usage: cpx-cli pack|validate-pack|run|report');
