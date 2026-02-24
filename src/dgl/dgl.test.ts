import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { computeIntentFingerprint, toMarkdown, toSarif } from './index.js';

describe('dgl', () => {
  it('computes deterministic intent fingerprint', () => {
    const p = path.join(process.cwd(), 'docs/architecture/intent-manifest.json');
    const a = computeIntentFingerprint(p);
    const b = computeIntentFingerprint(p);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('renders markdown and sarif from report', () => {
    const report = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'dgl/examples/dgl_report.json'), 'utf-8'));
    expect(toMarkdown(report)).toContain('DGL Report');
    const sarif = toSarif(report) as any;
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0]?.results[0]?.locations[0]?.physicalLocation?.region?.startLine ?? 0).toBeGreaterThan(0);
  });
});
