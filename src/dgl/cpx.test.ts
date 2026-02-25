import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { cpxToMarkdown, runCpx, validatePatchPack, type PatchPack } from './cpx.js';

const root = process.cwd();
const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(root, 'dgl', 'cpx', 'fixtures', name), 'utf-8')) as PatchPack;

describe('CPX', () => {
  it('validates patch pack shape', () => {
    const result = validatePatchPack(fixture('s1-pack-a.json'));
    expect(result.ok).toBe(true);
  });

  it('produces deterministic ranking', () => {
    const packs = [fixture('s1-pack-a.json'), fixture('s1-pack-b.json')];
    const first = runCpx(packs, root);
    const second = runCpx([...packs].reverse(), root);
    expect(first.per_patch.map((p) => p.pack_id)).toEqual(second.per_patch.map((p) => p.pack_id));
    expect(first.arbitration.decision_type).toEqual(second.arbitration.decision_type);
  });

  it('classifies semantic overlap as merge-plan candidate', () => {
    const report = runCpx([fixture('s2-pack-a.json'), fixture('s2-pack-b.json')], root);
    expect(report.arbitration.decision_type).toBe('PROPOSE_MERGE_PLAN');
  });

  it('renders markdown summary', () => {
    const report = runCpx([fixture('s3-pack-a.json'), fixture('s3-pack-b.json')], root);
    const md = cpxToMarkdown(report);
    expect(md).toContain('CPX Arbitration Summary');
    expect(md).toContain('Decision:');
  });
});
